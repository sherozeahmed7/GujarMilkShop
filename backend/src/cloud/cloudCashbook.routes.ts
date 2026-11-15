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

// POST /api/cashbook/persons - Create cash person in Neon
router.post('/persons', requireCloudScreen('Cashbook'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, phone, address, type, description, openingBalance, customerType } = req.body;
    if (!name || !name.trim()) {
      return ApiResponse.error(res, 'Name is required', 400);
    }
    const crypto = await import('crypto');
    const cloudUuid = crypto.randomUUID();
    const maxIdRes = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM cash_persons');
    const nextLocalId = maxIdRes.rows[0]?.next_id || 1;

    const insertRes = await queryWithRetry(`
      INSERT INTO cash_persons (
        id, local_id, device_id, name, phone, address, type, description,
        opening_balance, customer_type, status, created_at, updated_at
      ) VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, $7, $8, $9, 'Active', NOW(), NOW())
      RETURNING *
    `, [
      cloudUuid, nextLocalId, name.trim(), phone || null, address || null,
      type || 'Incoming', description || null, Number(openingBalance || 0),
      customerType || 'Debtor'
    ]);

    const p = insertRes.rows[0];
    return ApiResponse.success(res, 'Cash person created', {
      id: String(p.local_id || p.id),
      name: p.name,
      phone: p.phone,
      address: p.address,
      type: p.type,
      description: p.description,
      openingBalance: Number(p.opening_balance || 0),
      customerType: p.customer_type,
      status: p.status,
      createdAt: p.created_at ? new Date(p.created_at).toISOString() : '',
      updatedAt: p.updated_at ? new Date(p.updated_at).toISOString() : '',
    }, 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/cashbook/persons/:id - Update cash person in Neon
router.put('/persons/:id', requireCloudScreen('Cashbook'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const { name, phone, address, type, description, openingBalance, customerType, status } = req.body;
    const personRes = await queryWithRetry(`SELECT * FROM cash_persons WHERE ${whereField} = $1`, [id]);
    if (personRes.rows.length === 0) {
      return ApiResponse.error(res, 'Person not found', 404);
    }
    const current = personRes.rows[0];

    const updatedRes = await queryWithRetry(`
      UPDATE cash_persons
      SET 
        name = COALESCE($1, name),
        phone = COALESCE($2, phone),
        address = COALESCE($3, address),
        type = COALESCE($4, type),
        description = COALESCE($5, description),
        opening_balance = COALESCE($6, opening_balance),
        customer_type = COALESCE($7, customer_type),
        status = COALESCE($8, status),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [
      name !== undefined ? name.trim() : null,
      phone !== undefined ? phone : null,
      address !== undefined ? address : null,
      type !== undefined ? type : null,
      description !== undefined ? description : null,
      openingBalance !== undefined ? Number(openingBalance) : null,
      customerType !== undefined ? customerType : null,
      status !== undefined ? status : null,
      current.id
    ]);

    const p = updatedRes.rows[0];
    return ApiResponse.success(res, 'Cash person updated', {
      id: String(p.local_id || p.id),
      name: p.name,
      phone: p.phone,
      address: p.address,
      type: p.type,
      description: p.description,
      openingBalance: Number(p.opening_balance || 0),
      customerType: p.customer_type,
      status: p.status,
      createdAt: p.created_at ? new Date(p.created_at).toISOString() : '',
      updatedAt: p.updated_at ? new Date(p.updated_at).toISOString() : '',
    }, 200);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/cashbook/persons/:id/status - Toggle active/disabled
router.patch('/persons/:id/status', requireCloudScreen('Cashbook'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const personRes = await queryWithRetry(`SELECT * FROM cash_persons WHERE ${whereField} = $1`, [id]);
    if (personRes.rows.length === 0) {
      return ApiResponse.error(res, 'Person not found', 404);
    }
    const current = personRes.rows[0];
    const newStatus = current.status === 'Active' ? 'Disabled' : 'Active';

    const updatedRes = await queryWithRetry(`
      UPDATE cash_persons SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *
    `, [newStatus, current.id]);

    const p = updatedRes.rows[0];
    return ApiResponse.success(res, `Cash person ${newStatus.toLowerCase()}`, {
      id: String(p.local_id || p.id),
      name: p.name,
      status: p.status,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/cashbook/transactions - Record cashbook transaction
router.post('/transactions', requireCloudScreen('Cashbook'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { personId, transactionType, amount, description, date } = req.body;
    const txAmt = Number(amount || 0);
    if (txAmt <= 0) return ApiResponse.error(res, 'Transaction amount must be greater than zero', 400);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(personId));
    const whereField = isUuid ? 'id' : 'local_id::text';

    const personRes = await queryWithRetry(`SELECT * FROM cash_persons WHERE ${whereField} = $1`, [String(personId)]);
    if (personRes.rows.length === 0) {
      return ApiResponse.error(res, 'Person not found', 404);
    }
    const person = personRes.rows[0];

    const crypto = await import('crypto');
    const cloudUuid = crypto.randomUUID();
    const maxIdRes = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM cashbook_transactions');
    const nextLocalId = maxIdRes.rows[0]?.next_id || 1;

    const txDate = date || new Date().toISOString().split('T')[0];
    const createdBy = req.user?.email || 'Cloud User';

    const insertRes = await queryWithRetry(`
      INSERT INTO cashbook_transactions (
        id, local_id, device_id, cash_person_uuid, cash_person_name,
        transaction_type, amount, description, date, created_by, created_at
      ) VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *
    `, [
      cloudUuid, nextLocalId, person.id, person.name,
      transactionType || 'Receive Amount', txAmt, description || null,
      txDate, createdBy
    ]);

    const tx = insertRes.rows[0];
    return ApiResponse.success(res, 'Transaction recorded successfully', {
      id: String(tx.local_id || tx.id),
      personId: String(person.local_id || person.id),
      cashPersonName: tx.cash_person_name,
      transactionType: tx.transaction_type,
      amount: Number(tx.amount),
      description: tx.description,
      date: tx.date,
      createdBy: tx.created_by,
      createdAt: tx.created_at ? new Date(tx.created_at).toISOString() : '',
    }, 201);
  } catch (err) {
    next(err);
  }
});

export default router;

