import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/cashbook/summary
router.get('/summary', requireCloudScreen('Cashbook'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const [personsRes, txAgg] = await Promise.all([
      queryWithRetry('SELECT type, customer_type, opening_balance FROM cash_persons WHERE status = \'Active\''),
      queryWithRetry(`
        SELECT 
          transaction_type,
          COALESCE(SUM(amount), 0)::float AS total_amount
        FROM cashbook_transactions
        GROUP BY transaction_type
      `),
    ]);

    let incomingBalance = 0;
    let outgoingBalance = 0;
    for (const p of personsRes.rows) {
      const bal = Number(p.opening_balance) || 0;
      if (p.type === 'Incoming' || p.customer_type === 'Debtor') {
        incomingBalance += bal;
      } else {
        outgoingBalance += bal;
      }
    }

    let totalReceived = 0;
    let totalPaid = 0;
    for (const row of txAgg.rows) {
      const amt = Number(row.total_amount) || 0;
      if (row.transaction_type === 'Receive Amount') {
        totalReceived += amt;
      } else if (row.transaction_type === 'Pay Amount') {
        totalPaid += amt;
      }
    }

    return ApiResponse.success(res, 'Cashbook summary fetched', {
      incomingBalance,
      outgoingBalance,
      netBalance: incomingBalance - outgoingBalance,
      totalReceived,
      totalPaid,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/cashbook/persons
router.get('/persons', requireCloudScreen('Cashbook'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry(`
      SELECT 
        id, local_id, name, phone, address, type, description,
        opening_balance AS "openingBalance",
        customer_type AS "customerType",
        status, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM cash_persons
      ORDER BY name ASC
    `);

    const rows = result.rows.map((p: any) => ({
      ...p,
      id: String(p.local_id || p.id),
      openingBalance: Number(p.openingBalance || 0),
    }));

    return ApiResponse.success(res, 'Cashbook persons fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/cashbook/persons/:id/ledger
router.get('/persons/:id/ledger', requireCloudScreen('Cashbook'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id';

    const personRes = await queryWithRetry(`SELECT * FROM cash_persons WHERE ${whereField} = $1`, [id]);
    if (personRes.rows.length === 0) {
      return ApiResponse.error(res, 'Person not found', 404);
    }
    const person = personRes.rows[0];

    const txRes = await queryWithRetry(`
      SELECT 
        id, local_id, transaction_type AS "transactionType", amount, description, date, created_by AS "createdBy", created_at AS "createdAt"
      FROM cashbook_transactions
      WHERE cash_person_uuid = $1
      ORDER BY date ASC, created_at ASC
    `, [person.id]);

    let runningBalance = Number(person.opening_balance || 0);
    const entries = txRes.rows.map((tx: any) => {
      const amt = Number(tx.amount || 0);
      if (tx.transactionType === 'Receive Amount') {
        runningBalance -= amt;
      } else if (tx.transactionType === 'Pay Amount') {
        runningBalance += amt;
      }
      return {
        id: String(tx.local_id || tx.id),
        date: tx.date,
        transactionType: tx.transactionType,
        amount: amt,
        runningBalance,
        description: tx.description || '',
        createdBy: tx.createdBy || 'System',
      };
    });

    return ApiResponse.success(res, 'Cashbook person ledger fetched', {
      person: {
        id: String(person.local_id || person.id),
        name: person.name,
        type: person.type,
        customerType: person.customer_type,
        openingBalance: Number(person.opening_balance || 0),
        status: person.status,
      },
      entries,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/cashbook/persons/:id
router.get('/persons/:id', requireCloudScreen('Cashbook'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id';

    const personRes = await queryWithRetry(`SELECT * FROM cash_persons WHERE ${whereField} = $1`, [id]);
    if (personRes.rows.length === 0) {
      return ApiResponse.error(res, 'Person not found', 404);
    }
    const p = personRes.rows[0];
    return ApiResponse.success(res, 'Person fetched', {
      ...p,
      id: String(p.local_id || p.id),
      openingBalance: Number(p.opening_balance || 0),
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/cashbook/transactions
router.get('/transactions', requireCloudScreen('Cashbook'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    let query = `
      SELECT 
        id, local_id, cash_person_name AS "cashPersonName",
        transaction_type AS "transactionType", amount, description, date, created_by AS "createdBy", created_at AS "createdAt"
      FROM cashbook_transactions
    `;
    const params: any[] = [];
    if (from && to) {
      query += ' WHERE date >= $1 AND date <= $2';
      params.push(from, to);
    }
    query += ' ORDER BY date DESC, created_at DESC LIMIT 100';

    const result = await queryWithRetry(query, params);
    const rows = result.rows.map((tx: any) => ({
      ...tx,
      id: String(tx.local_id || tx.id),
      amount: Number(tx.amount || 0),
    }));

    return ApiResponse.success(res, 'Cashbook transactions fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

export default router;

