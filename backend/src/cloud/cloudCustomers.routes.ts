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
    let query = 'SELECT * FROM customers';
    const params: any[] = [];
    if (search) {
      query += ' WHERE LOWER(name) LIKE $1 OR phone LIKE $1';
      params.push(`%${search.toLowerCase()}%`);
    }
    query += ' ORDER BY name ASC';

    const result = await queryWithRetry(query, params);
    return ApiResponse.success(res, 'Customers fetched from Neon', result.rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/customers/summary
router.get('/summary', requireCloudScreen('Customers'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const scope = req.query.scope as string;

    const [activeCustomersRes, activeSalesDuesRes] = await Promise.all([
      queryWithRetry("SELECT COUNT(*)::int AS count FROM customers WHERE LOWER(status) = 'active'"),
      queryWithRetry(`
        SELECT 
          COALESCE(SUM(remaining_balance), 0)::float AS total_outstanding,
          COUNT(DISTINCT customer_uuid)::int AS customers_with_dues
        FROM sales
        WHERE remaining_balance > 0 AND customer_uuid IS NOT NULL
      `),
    ]);

    const totalCustomers = activeCustomersRes.rows[0]?.count || 0;
    const dues = activeSalesDuesRes.rows[0] || {};
    const totalOutstanding = dues.total_outstanding || 0;
    const withDues = dues.customers_with_dues || 0;

    if (scope === 'ledger') {
      return ApiResponse.success(res, 'Ledger summary fetched', {
        totalCustomers,
        totalOutstanding,
        withDues,
        withoutDues: Math.max(0, totalCustomers - withDues),
      }, 200);
    }

    return ApiResponse.success(res, 'Customer summary fetched', {
      totalCustomers,
      totalOutstanding,
      withDues,
      withoutDues: Math.max(0, totalCustomers - withDues),
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
