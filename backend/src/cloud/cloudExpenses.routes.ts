import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';
import crypto from 'crypto';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/expenses/summary
router.get('/summary', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const expenseType = req.query.expenseType as string;

    let query = 'SELECT * FROM expenses';
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (from && to) {
      conditions.push(`date >= $${pIdx++} AND date <= $${pIdx++}`);
      params.push(from, to);
    }
    if (expenseType) {
      conditions.push(`UPPER(expense_type) = $${pIdx++}`);
      params.push(expenseType.toUpperCase());
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await queryWithRetry(query, params);
    const rows = result.rows;

    const grossLoss = rows.reduce((s: number, r: any) => s + (Number(r.gross_loss || r.amount) || 0), 0);
    const netExpense = rows.reduce((s: number, r: any) => s + (Number(r.net_expense || r.amount) || 0), 0);
    const paid = rows.reduce((s: number, r: any) => s + (Number(r.paid_amount) || 0), 0);
    const remaining = rows.reduce((s: number, r: any) => s + (Number(r.remaining) || 0), 0);

    const personal = rows.filter((r: any) => (r.expense_type || '').toUpperCase() === 'PERSONAL');
    const totalPersonalExpense = personal.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
    const totalCashReceived = personal.reduce((s: number, r: any) => s + (Number(r.paid_amount) || 0), 0);
    const personalRemaining = personal.reduce((s: number, r: any) => s + (Number(r.remaining) || 0), 0);

    return ApiResponse.success(res, 'Expense summary fetched', {
      stock: 0,
      avgCost: 0,
      grossLoss,
      netExpense,
      paid,
      remaining,
      totalPersonalExpense,
      totalCashReceived,
      remainingBalance: personalRemaining,
      personalCount: personal.length,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses/breakdown
router.get('/breakdown', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const typeParam = req.query.expenseType ? String(req.query.expenseType).toUpperCase() : undefined;
    const now = new Date();
    const yyyyMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    let query = `
      SELECT category, COALESCE(SUM(amount), 0)::float AS amount
      FROM expenses
      WHERE date LIKE $1
    `;
    const params: any[] = [`${yyyyMM}%`];
    if (typeParam) {
      query += ` AND UPPER(expense_type) = $2`;
      params.push(typeParam);
    }
    query += ` GROUP BY category ORDER BY amount DESC`;

    let result = await queryWithRetry(query, params);
    
    if (result.rows.length === 0) {
      let fallbackQuery = `
        SELECT category, COALESCE(SUM(amount), 0)::float AS amount
        FROM expenses
      `;
      const fallbackParams: any[] = [];
      if (typeParam) {
        fallbackQuery += ` WHERE UPPER(expense_type) = $1`;
        fallbackParams.push(typeParam);
      }
      fallbackQuery += ` GROUP BY category ORDER BY amount DESC`;
      result = await queryWithRetry(fallbackQuery, fallbackParams);
    }

    const totalAmount = result.rows.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
    const rows = result.rows.map((r: any) => {
      const amount = Number(r.amount || 0);
      return {
        category: r.category || 'Other',
        amount,
        total: amount,
        percentage: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
      };
    });

    return ApiResponse.success(res, 'Expense breakdown fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/expenses/personal/receive - FIFO settlement across personal expenses
router.post('/personal/receive', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const amount = Number(req.body?.amount || 0);
    if (amount <= 0) return ApiResponse.error(res, 'Amount must be greater than zero', 400);

    const date = req.body?.date || new Date().toISOString().split('T')[0];
    const notes = req.body?.notes || '';

    // Fetch personal expenses with remaining > 0 ordered by date ASC (FIFO)
    const pendingRes = await queryWithRetry(`
      SELECT * FROM expenses
      WHERE UPPER(expense_type) = 'PERSONAL' AND remaining > 0
      ORDER BY date ASC, created_at ASC
    `);

    let remainingToSettle = amount;
    let settledCount = 0;

    for (const exp of pendingRes.rows) {
      if (remainingToSettle <= 0) break;
      const due = Number(exp.remaining || 0);
      const toPay = Math.min(due, remainingToSettle);
      const newPaid = Number(exp.paid_amount || 0) + toPay;
      const newRemaining = Math.max(0, due - toPay);

      await queryWithRetry(`
        UPDATE expenses
        SET paid_amount = $1, remaining = $2, updated_at = NOW()
        WHERE id = $3
      `, [newPaid, newRemaining, exp.id]);

      // Record payment
      const pId = crypto.randomUUID();
      const pMax = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM expense_payments');
      const nextLocalId = pMax.rows[0]?.next_id || 1;

      await queryWithRetry(`
        INSERT INTO expense_payments (id, local_id, device_id, expense_uuid, amount, date, added_by, created_at, updated_at)
        VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, NOW(), NOW())
      `, [pId, nextLocalId, exp.id, toPay, date, req.user?.email || 'Admin']);

      remainingToSettle -= toPay;
      settledCount++;
    }

    return ApiResponse.success(res, 'Cash received recorded successfully', {
      settledCount,
      totalReceived: amount - remainingToSettle,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses
router.get('/', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string;
    const to = req.query.to as string;
    const category = req.query.category as string;
    const expenseType = req.query.expenseType as string;

    let query = 'SELECT * FROM expenses';
    const conditions: string[] = [];
    const params: any[] = [];
    let pIdx = 1;

    if (from && to) {
      conditions.push(`date >= $${pIdx++} AND date <= $${pIdx++}`);
      params.push(from, to);
    }
    if (category && category !== 'All') {
      conditions.push(`category = $${pIdx++}`);
      params.push(category);
    }
    if (expenseType) {
      conditions.push(`UPPER(expense_type) = $${pIdx++}`);
      params.push(expenseType.toUpperCase());
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY date DESC, created_at DESC';

    const result = await queryWithRetry(query, params);
    const rows = result.rows.map((row: any) => ({
      id: String(row.local_id || row.id),
      date: row.date,
      category: row.category,
      description: row.description || '',
      quantity: Number(row.quantity || 0),
      unitCost: Number(row.unit_cost || 0),
      grossLoss: Number(row.gross_loss || row.amount || 0),
      soldRecovery: Number(row.sold_recovery || 0),
      netExpense: Number(row.net_expense || row.amount || 0),
      amount: Number(row.amount || 0),
      paidAmount: Number(row.paid_amount || 0),
      remaining: Number(row.remaining || 0),
      reason: row.reason || '',
      addedBy: row.added_by || 'Admin',
      expenseType: row.expense_type || 'SHOP',
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      payments: [],
    }));

    return ApiResponse.success(res, 'Expenses fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/expenses - Create expense
router.post('/', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { date, category, description, quantity, unitCost, grossLoss, soldRecovery, netExpense, amount, reason, expenseType } = req.body;
    const amt = Number(amount || netExpense || grossLoss || 0);
    if (amt <= 0) return ApiResponse.error(res, 'Expense amount must be greater than zero', 400);

    const type = (expenseType || 'SHOP').toUpperCase();
    const expDate = date || new Date().toISOString().split('T')[0];
    const expCategory = category || 'General';
    const cloudUuid = crypto.randomUUID();

    const maxIdRes = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM expenses');
    const nextLocalId = maxIdRes.rows[0]?.next_id || 1;

    const remaining = type === 'PERSONAL' ? amt : 0;
    const paidAmount = type === 'PERSONAL' ? 0 : amt;

    const insertRes = await queryWithRetry(`
      INSERT INTO expenses (
        id, local_id, device_id, date, category, description,
        quantity, unit_cost, gross_loss, sold_recovery, net_expense,
        amount, paid_amount, remaining, reason, added_by, expense_type,
        created_at, updated_at
      ) VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
      RETURNING *
    `, [
      cloudUuid, nextLocalId, expDate, expCategory, description || null,
      Number(quantity || 0), Number(unitCost || 0), Number(grossLoss || amt),
      Number(soldRecovery || 0), Number(netExpense || amt), amt,
      paidAmount, remaining, reason || null, req.user?.email || 'Admin', type
    ]);

    const row = insertRes.rows[0];
    return ApiResponse.success(res, 'Expense created successfully', {
      id: String(row.local_id || row.id),
      date: row.date,
      category: row.category,
      description: row.description || '',
      quantity: Number(row.quantity || 0),
      unitCost: Number(row.unit_cost || 0),
      grossLoss: Number(row.gross_loss || amt),
      soldRecovery: Number(row.sold_recovery || 0),
      netExpense: Number(row.net_expense || amt),
      amount: Number(row.amount || 0),
      paidAmount: Number(row.paid_amount || 0),
      remaining: Number(row.remaining || 0),
      reason: row.reason || '',
      addedBy: row.added_by,
      expenseType: row.expense_type,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    }, 201);
  } catch (err) {
    next(err);
  }
});

// GET /api/expenses/:id
router.get('/:id', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const expRes = await queryWithRetry(`SELECT * FROM expenses WHERE ${whereField} = $1`, [id]);
    if (expRes.rows.length === 0) return ApiResponse.error(res, 'Expense not found', 404);

    const row = expRes.rows[0];
    const paymentsRes = await queryWithRetry('SELECT * FROM expense_payments WHERE expense_uuid = $1 ORDER BY date DESC', [row.id]);

    return ApiResponse.success(res, 'Expense fetched', {
      id: String(row.local_id || row.id),
      date: row.date,
      category: row.category,
      description: row.description || '',
      quantity: Number(row.quantity || 0),
      unitCost: Number(row.unit_cost || 0),
      grossLoss: Number(row.gross_loss || row.amount || 0),
      soldRecovery: Number(row.sold_recovery || 0),
      netExpense: Number(row.net_expense || row.amount || 0),
      amount: Number(row.amount || 0),
      paidAmount: Number(row.paid_amount || 0),
      remaining: Number(row.remaining || 0),
      reason: row.reason || '',
      addedBy: row.added_by,
      expenseType: row.expense_type,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      payments: paymentsRes.rows,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// PUT /api/expenses/:id - Update expense
router.put('/:id', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const { date, category, description, quantity, unitCost, grossLoss, soldRecovery, netExpense, amount, reason } = req.body;
    const expRes = await queryWithRetry(`SELECT * FROM expenses WHERE ${whereField} = $1`, [id]);
    if (expRes.rows.length === 0) return ApiResponse.error(res, 'Expense not found', 404);

    const current = expRes.rows[0];
    const newAmt = amount !== undefined ? Number(amount) : Number(current.amount);

    const updatedRes = await queryWithRetry(`
      UPDATE expenses
      SET 
        date = COALESCE($1, date),
        category = COALESCE($2, category),
        description = COALESCE($3, description),
        quantity = COALESCE($4, quantity),
        unit_cost = COALESCE($5, unit_cost),
        gross_loss = COALESCE($6, gross_loss),
        sold_recovery = COALESCE($7, sold_recovery),
        net_expense = COALESCE($8, net_expense),
        amount = COALESCE($9, amount),
        reason = COALESCE($10, reason),
        updated_at = NOW()
      WHERE id = $11
      RETURNING *
    `, [
      date || null, category || null, description !== undefined ? description : null,
      quantity !== undefined ? Number(quantity) : null,
      unitCost !== undefined ? Number(unitCost) : null,
      grossLoss !== undefined ? Number(grossLoss) : null,
      soldRecovery !== undefined ? Number(soldRecovery) : null,
      netExpense !== undefined ? Number(netExpense) : null,
      amount !== undefined ? newAmt : null,
      reason !== undefined ? reason : null,
      current.id
    ]);

    const row = updatedRes.rows[0];
    return ApiResponse.success(res, 'Expense updated successfully', {
      id: String(row.local_id || row.id),
      date: row.date,
      category: row.category,
      description: row.description || '',
      quantity: Number(row.quantity || 0),
      unitCost: Number(row.unit_cost || 0),
      grossLoss: Number(row.gross_loss || row.amount || 0),
      soldRecovery: Number(row.sold_recovery || 0),
      netExpense: Number(row.net_expense || row.amount || 0),
      amount: Number(row.amount || 0),
      paidAmount: Number(row.paid_amount || 0),
      remaining: Number(row.remaining || 0),
      reason: row.reason || '',
      addedBy: row.added_by,
      expenseType: row.expense_type,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
    }, 200);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    await queryWithRetry(`DELETE FROM expenses WHERE ${whereField} = $1`, [id]);
    return ApiResponse.success(res, 'Expense deleted successfully', null, 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/expenses/:id/pay - Pay toward an expense
router.post('/:id/pay', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const payAmt = Number(req.body?.amount || 0);
    if (payAmt <= 0) return ApiResponse.error(res, 'Payment amount must be greater than zero', 400);

    const expRes = await queryWithRetry(`SELECT * FROM expenses WHERE ${whereField} = $1`, [id]);
    if (expRes.rows.length === 0) return ApiResponse.error(res, 'Expense not found', 404);

    const current = expRes.rows[0];
    const newPaid = Number(current.paid_amount || 0) + payAmt;
    const newRemaining = Math.max(0, Number(current.remaining || current.amount || 0) - payAmt);

    const updatedRes = await queryWithRetry(`
      UPDATE expenses SET paid_amount = $1, remaining = $2, updated_at = NOW() WHERE id = $3 RETURNING *
    `, [newPaid, newRemaining, current.id]);

    const pId = crypto.randomUUID();
    const pMax = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM expense_payments');
    const nextLocalId = pMax.rows[0]?.next_id || 1;
    const pDate = req.body?.date || new Date().toISOString().split('T')[0];

    await queryWithRetry(`
      INSERT INTO expense_payments (id, local_id, device_id, expense_uuid, amount, date, added_by, created_at, updated_at)
      VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, NOW(), NOW())
    `, [pId, nextLocalId, current.id, payAmt, pDate, req.user?.email || 'Admin']);

    const row = updatedRes.rows[0];
    return ApiResponse.success(res, 'Payment recorded', {
      id: String(row.local_id || row.id),
      paidAmount: Number(row.paid_amount),
      remaining: Number(row.remaining),
    }, 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/expenses/:id/personal-receive
router.post('/:id/personal-receive', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const payAmt = Number(req.body?.amount || 0);
    if (payAmt <= 0) return ApiResponse.error(res, 'Amount must be greater than zero', 400);

    const expRes = await queryWithRetry(`SELECT * FROM expenses WHERE ${whereField} = $1`, [id]);
    if (expRes.rows.length === 0) return ApiResponse.error(res, 'Expense not found', 404);

    const current = expRes.rows[0];
    const newPaid = Number(current.paid_amount || 0) + payAmt;
    const newRemaining = Math.max(0, Number(current.remaining || 0) - payAmt);

    const updatedRes = await queryWithRetry(`
      UPDATE expenses SET paid_amount = $1, remaining = $2, updated_at = NOW() WHERE id = $3 RETURNING *
    `, [newPaid, newRemaining, current.id]);

    const pId = crypto.randomUUID();
    const pMax = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM expense_payments');
    const nextLocalId = pMax.rows[0]?.next_id || 1;
    const pDate = req.body?.date || new Date().toISOString().split('T')[0];

    await queryWithRetry(`
      INSERT INTO expense_payments (id, local_id, device_id, expense_uuid, amount, date, added_by, created_at, updated_at)
      VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, NOW(), NOW())
    `, [pId, nextLocalId, current.id, payAmt, pDate, req.user?.email || 'Admin']);

    const row = updatedRes.rows[0];
    return ApiResponse.success(res, 'Cash received against personal expense', {
      id: String(row.local_id || row.id),
      paidAmount: Number(row.paid_amount),
      remaining: Number(row.remaining),
    }, 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/expenses/:id/personal-return
router.post('/:id/personal-return', requireCloudScreen('Expenses'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const retAmt = Number(req.body?.amount || 0);
    if (retAmt <= 0) return ApiResponse.error(res, 'Return amount must be greater than zero', 400);

    const expRes = await queryWithRetry(`SELECT * FROM expenses WHERE ${whereField} = $1`, [id]);
    if (expRes.rows.length === 0) return ApiResponse.error(res, 'Expense not found', 404);

    const current = expRes.rows[0];
    const currentPaid = Number(current.paid_amount || 0);
    if (retAmt > currentPaid) return ApiResponse.error(res, `Cannot return more than already received (Rs. ${currentPaid})`, 400);

    const newPaid = Math.max(0, currentPaid - retAmt);
    const newRemaining = Number(current.remaining || 0) + retAmt;

    const updatedRes = await queryWithRetry(`
      UPDATE expenses SET paid_amount = $1, remaining = $2, updated_at = NOW() WHERE id = $3 RETURNING *
    `, [newPaid, newRemaining, current.id]);

    const row = updatedRes.rows[0];
    return ApiResponse.success(res, 'Cash returned against personal expense', {
      id: String(row.local_id || row.id),
      paidAmount: Number(row.paid_amount),
      remaining: Number(row.remaining),
    }, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
