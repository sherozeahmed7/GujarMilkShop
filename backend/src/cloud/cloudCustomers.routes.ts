import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';
import crypto from 'crypto';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/customers
router.get('/', requireCloudScreen('Customers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = req.query.search as string;
    const status = req.query.status as string;
    const customerType = req.query.customerType as string;
    const dues = req.query.dues === 'true' || String(req.query.dues) === 'true';

    // Join customers with sales to calculate real dues, currentDue, previousDue, and lastSaleDate
    let query = `
      SELECT 
        c.id, c.local_id, c.device_id, c.name, c.phone, c.address, c.customer_type, c.status,
        c.created_at, c.updated_at,
        COALESCE(SUM(s.total_amount), 0)::float AS total_amount,
        COALESCE(SUM(s.paid_amount), 0)::float AS paid_amount,
        COALESCE(SUM(s.remaining_balance), 0)::float AS remaining_balance,
        MAX(s.created_at) AS last_sale_date
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_uuid
      WHERE c.customer_type IN ('daily_ledger', 'monthly_ledger')
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (status && status !== 'all') {
      query += ` AND LOWER(c.status) = LOWER($${pIdx++})`;
      params.push(status);
    }

    if (customerType) {
      query += ` AND c.customer_type = $${pIdx++}`;
      params.push(customerType);
    }

    if (search) {
      query += ` AND (LOWER(c.name) LIKE $${pIdx} OR c.phone LIKE $${pIdx})`;
      pIdx++;
      params.push(`%${search.toLowerCase()}%`);
    }

    query += ' GROUP BY c.id, c.local_id, c.device_id, c.name, c.phone, c.address, c.customer_type, c.status, c.created_at, c.updated_at';

    if (dues) {
      query += ' HAVING COALESCE(SUM(s.remaining_balance), 0) > 0';
    }

    query += ' ORDER BY c.name ASC';

    const result = await queryWithRetry(query, params);
    const rows = result.rows.map((r: any) => ({
      id: r.local_id || r.id,
      name: r.name,
      phone: r.phone || null,
      address: r.address || null,
      customerType: r.customer_type,
      status: r.status || 'active',
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
      updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : '',
      currentDue: Number(r.remaining_balance || 0),
      previousDue: 0,
      totalAmount: Number(r.total_amount || 0),
      paidAmount: Number(r.paid_amount || 0),
      remainingBalance: Number(r.remaining_balance || 0),
      totalDue: Number(r.remaining_balance || 0),
      lastSaleDate: r.last_sale_date ? new Date(r.last_sale_date).toISOString() : null,
      customMilkRate: null,
    }));

    return res.status(200).json({
      status: 'success',
      message: 'Customers fetched from Neon',
      data: rows,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/summary
router.get('/summary', requireCloudScreen('Customers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const scope = req.query.scope as string;

    const [activeCustomersRes, activeSalesDuesRes, totalSalesCountRes] = await Promise.all([
      queryWithRetry("SELECT COUNT(*)::int AS count FROM customers WHERE LOWER(status) = 'active' AND customer_type IN ('daily_ledger', 'monthly_ledger')"),
      queryWithRetry(`
        SELECT 
          COALESCE(SUM(remaining_balance), 0)::float AS total_outstanding,
          COUNT(DISTINCT customer_uuid)::int AS customers_with_dues
        FROM sales
        WHERE remaining_balance > 0 AND customer_uuid IS NOT NULL
      `),
      queryWithRetry("SELECT COUNT(*)::int AS count FROM customers WHERE customer_type IN ('daily_ledger', 'monthly_ledger')"),
    ]);

    const activeCustomers = activeCustomersRes.rows[0]?.count || 0;
    const totalRows = totalSalesCountRes.rows[0]?.count || 0;
    const dues = activeSalesDuesRes.rows[0] || {};
    const totalOutstanding = dues.total_outstanding || 0;
    const withDues = dues.customers_with_dues || 0;

    const payload = {
      totalRows,
      totalCustomers: activeCustomers,
      totalOutstanding,
      withDues,
      withoutDues: Math.max(0, activeCustomers - withDues),
      khataAccounts: activeCustomers,
      collectedToday: 0,
      pendingCount: withDues,
      paidCount: Math.max(0, activeCustomers - withDues),
    };

    return res.status(200).json({
      status: 'success',
      message: scope === 'ledger' ? 'Ledger summary fetched' : 'Customer summary fetched',
      data: payload,
      ...payload,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/collected-breakdown (must be mounted before /:id)
router.get('/collected-breakdown', requireCloudScreen('Customers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;

    let query = `
      SELECT 
        c.id, c.local_id, c.name, c.phone, c.address, c.customer_type,
        COALESCE(SUM(p.amount), 0)::float AS total_paid,
        MAX(p.created_at) AS last_payment_date,
        COUNT(p.id)::int AS payment_count
      FROM customers c
      JOIN sales s ON c.id = s.customer_uuid
      JOIN payments p ON s.id = p.sale_uuid
      WHERE p.amount > 0
    `;
    const params: any[] = [];
    let pIdx = 1;
    if (fromDate) {
      query += ` AND p.created_at >= $${pIdx++}::timestamp`;
      params.push(fromDate.includes('T') ? fromDate : `${fromDate} 00:00:00`);
    }
    if (toDate) {
      query += ` AND p.created_at <= $${pIdx++}::timestamp`;
      params.push(toDate.includes('T') ? toDate : `${toDate} 23:59:59`);
    }

    query += `
      GROUP BY c.id, c.local_id, c.name, c.phone, c.address, c.customer_type
      ORDER BY total_paid DESC
    `;

    const result = await queryWithRetry(query, params);
    const rows = result.rows.map((r: any) => ({
      customerId: r.local_id || r.id,
      customerName: r.name,
      phone: r.phone || null,
      address: r.address || null,
      customerType: r.customer_type,
      totalPaid: Number(r.total_paid || 0),
      lastPaymentDate: r.last_payment_date ? new Date(r.last_payment_date).toISOString() : null,
      paymentCount: Number(r.payment_count || 0),
    }));

    return ApiResponse.success(res, 'Collected breakdown fetched', rows, 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/customers - Create new customer in Neon
router.post('/', requireCloudScreen('Customers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const { name, phone, address, customerType } = req.body;
    if (!name || !name.trim()) {
      return ApiResponse.error(res, 'Customer name is required', 400);
    }
    const type = customerType === 'monthly_ledger' ? 'monthly_ledger' : 'daily_ledger';
    const cloudUuid = crypto.randomUUID();

    const maxIdRes = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM customers');
    const nextLocalId = maxIdRes.rows[0]?.next_id || 1;

    const insertRes = await queryWithRetry(`
      INSERT INTO customers (id, local_id, device_id, name, phone, address, customer_type, status, created_at, updated_at)
      VALUES ($1, $2, 'web-portal', $3, $4, $5, $6, 'active', NOW(), NOW())
      RETURNING *
    `, [cloudUuid, nextLocalId, name.trim(), phone || null, address || null, type]);

    const c = insertRes.rows[0];
    const created = {
      id: c.local_id || c.id,
      name: c.name,
      phone: c.phone || null,
      address: c.address || null,
      customerType: c.customer_type,
      status: c.status || 'active',
      createdAt: c.created_at ? new Date(c.created_at).toISOString() : '',
      updatedAt: c.updated_at ? new Date(c.updated_at).toISOString() : '',
      currentDue: 0,
      previousDue: 0,
      totalAmount: 0,
      paidAmount: 0,
      remainingBalance: 0,
      totalDue: 0,
      lastSaleDate: null,
      customMilkRate: null,
    };
    return ApiResponse.success(res, 'Customer created successfully', created, 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/customers/:id - Update customer in Neon
router.put('/:id', requireCloudScreen('Customers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const { name, phone, address, customerType } = req.body;
    const existing = await queryWithRetry(`SELECT * FROM customers WHERE ${whereField} = $1`, [id]);
    if (existing.rows.length === 0) {
      return ApiResponse.error(res, 'Customer not found', 404);
    }

    const c = existing.rows[0];
    const updateRes = await queryWithRetry(`
      UPDATE customers
      SET name = $1, phone = $2, address = $3, customer_type = $4, updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [
      name !== undefined ? name.trim() : c.name,
      phone !== undefined ? (phone || null) : c.phone,
      address !== undefined ? (address || null) : c.address,
      customerType !== undefined ? customerType : c.customer_type,
      c.id
    ]);

    const updated = updateRes.rows[0];
    return ApiResponse.success(res, 'Customer updated successfully', {
      id: updated.local_id || updated.id,
      name: updated.name,
      phone: updated.phone || null,
      address: updated.address || null,
      customerType: updated.customer_type,
      status: updated.status || 'active',
      createdAt: updated.created_at ? new Date(updated.created_at).toISOString() : '',
      updatedAt: updated.updated_at ? new Date(updated.updated_at).toISOString() : '',
    }, 200);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/customers/:id - Deactivate customer in Neon
router.delete('/:id', requireCloudScreen('Customers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    await queryWithRetry(`UPDATE customers SET status = 'inactive', updated_at = NOW() WHERE ${whereField} = $1`, [id]);
    return ApiResponse.success(res, 'Customer deactivated', null, 200);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/customers/:id/status - Toggle status in Neon
router.patch('/:id/status', requireCloudScreen('Customers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';
    const status = (req.body?.status || 'active').toLowerCase();

    await queryWithRetry(`UPDATE customers SET status = $1, updated_at = NOW() WHERE ${whereField} = $2`, [status, id]);
    return ApiResponse.success(res, 'Customer status updated', { status }, 200);
  } catch (err) {
    next(err);
  }
});

// POST /api/customers/:id/settle-all - Settle customer ledger dues in Neon
router.post('/:id/settle-all', requireCloudScreen('Customers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const custRes = await queryWithRetry(`SELECT * FROM customers WHERE ${whereField} = $1`, [id]);
    if (custRes.rows.length === 0) {
      return ApiResponse.error(res, 'Customer not found', 404);
    }
    const customer = custRes.rows[0];
    const paymentMethod = req.body?.paymentMethod || 'cash';
    let amountToSettle = req.body?.amount !== undefined ? Number(req.body.amount) : null;
    const discount = Number(req.body?.discount || 0);

    // Fetch all pending/partial sales for this customer
    const salesRes = await queryWithRetry(`
      SELECT * FROM sales
      WHERE customer_uuid = $1 AND remaining_balance > 0
      ORDER BY created_at ASC
    `, [customer.id]);

    if (salesRes.rows.length === 0) {
      return ApiResponse.success(res, 'No pending dues found for this customer.', { settledCount: 0, totalSettled: 0 }, 200);
    }

    const totalOutstanding = salesRes.rows.reduce((sum: number, s: any) => sum + Number(s.remaining_balance || 0), 0);
    let remainingToCollect = amountToSettle !== null ? amountToSettle : totalOutstanding;
    let settledCount = 0;
    let totalSettled = 0;

    for (const sale of salesRes.rows) {
      if (remainingToCollect <= 0) break;
      const saleDue = Number(sale.remaining_balance || 0);
      const toPay = Math.min(saleDue, remainingToCollect);
      const newPaid = Number(sale.paid_amount || 0) + toPay;
      const newRemaining = Math.max(0, saleDue - toPay);
      const newStatus = newRemaining === 0 ? 'completed' : 'partial';

      // Update sale
      await queryWithRetry(`
        UPDATE sales
        SET paid_amount = $1, remaining_balance = $2, status = $3, updated_at = NOW()
        WHERE id = $4
      `, [newPaid, newRemaining, newStatus, sale.id]);

      // Record payment
      const pId = crypto.randomUUID();
      const pMaxIdRes = await queryWithRetry('SELECT COALESCE(MAX(local_id), 0) + 1 AS next_id FROM payments');
      const pLocalId = pMaxIdRes.rows[0]?.next_id || 1;

      await queryWithRetry(`
        INSERT INTO payments (id, local_id, device_id, sale_uuid, method, amount, status, created_at, updated_at)
        VALUES ($1, $2, 'web-portal', $3, $4, $5, 'completed', NOW(), NOW())
      `, [pId, pLocalId, sale.id, paymentMethod, toPay]);

      remainingToCollect -= toPay;
      totalSettled += toPay;
      settledCount++;
    }

    return ApiResponse.success(res, 'Dues settled successfully', {
      settledCount,
      totalSettled,
      totalDiscount: discount,
      remainingOutstanding: Math.max(0, totalOutstanding - totalSettled - discount),
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/:id
router.get('/:id', requireCloudScreen('Customers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id::text';

    const custRes = await queryWithRetry(`SELECT * FROM customers WHERE ${whereField} = $1`, [id]);
    if (custRes.rows.length === 0) {
      return ApiResponse.error(res, 'Customer not found', 404);
    }
    const customer = custRes.rows[0];

    // Fetch ledger sales and payments for customer
    const [salesRes, paymentsRes] = await Promise.all([
      queryWithRetry('SELECT * FROM sales WHERE customer_uuid = $1 ORDER BY created_at DESC LIMIT 50', [customer.id]),
      queryWithRetry(`
        SELECT p.* FROM payments p
        JOIN sales s ON p.sale_uuid = s.id
        WHERE s.customer_uuid = $1
        ORDER BY p.created_at DESC LIMIT 50
      `, [customer.id]),
    ]);

    customer.recentSales = salesRes.rows;
    customer.recentPayments = paymentsRes.rows;

    return ApiResponse.success(res, 'Customer fetched', customer, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
