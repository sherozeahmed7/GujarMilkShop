import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/dashboard/stats
router.get('/stats', requireCloudScreen('Dashboard'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    // Parallel queries to Neon
    const [salesAgg, customerCount, supplierCount, lowStockRes, recentSalesRes] = await Promise.all([
      queryWithRetry(`
        SELECT 
          COUNT(*)::int AS total_sales_count,
          COALESCE(SUM(total_amount), 0)::float AS total_revenue,
          COALESCE(SUM(paid_amount), 0)::float AS total_paid,
          COALESCE(SUM(remaining_balance), 0)::float AS total_due
        FROM sales
      `),
      queryWithRetry("SELECT COUNT(*)::int AS count FROM customers WHERE LOWER(status) = 'active'"),
      queryWithRetry("SELECT COUNT(*)::int AS count FROM suppliers WHERE is_active = true"),
      queryWithRetry(`
        SELECT COUNT(*)::int AS count 
        FROM inventory_products 
        WHERE is_active = true
      `),
      queryWithRetry(`
        SELECT id, local_id, sale_type, customer_name, total_amount, paid_amount, status, created_at
        FROM sales
        ORDER BY created_at DESC
        LIMIT 10
      `),
    ]);

    const stats = salesAgg.rows[0];
    const responseData = {
      totalSalesCount: stats.total_sales_count,
      totalRevenue: stats.total_revenue,
      totalPaid: stats.total_paid,
      totalDue: stats.total_due,
      activeCustomers: customerCount.rows[0].count,
      activeSuppliers: supplierCount.rows[0].count,
      totalProducts: lowStockRes.rows[0].count,
      recentSales: recentSalesRes.rows,
      cloudMode: true,
      dataStore: 'Neon PostgreSQL',
    };

    return ApiResponse.success(res, 'Dashboard stats fetched from Neon', responseData, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/revenue-chart
router.get('/revenue-chart', requireCloudScreen('Dashboard'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const chartRes = await queryWithRetry(`
      SELECT 
        DATE(created_at) AS date,
        COALESCE(SUM(total_amount), 0)::float AS revenue,
        COUNT(*)::int AS count
      FROM sales
      WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC
    `);

    return ApiResponse.success(res, 'Revenue chart data fetched', chartRes.rows, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
