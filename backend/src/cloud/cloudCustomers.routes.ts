import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

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

// GET /api/customers/:id
router.get('/:id', requireCloudScreen('Customers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const whereField = isUuid ? 'id' : 'local_id';

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
