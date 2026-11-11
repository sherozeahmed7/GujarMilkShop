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

// GET /api/dashboard/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/metrics', requireCloudScreen('Dashboard'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
    const to = (req.query.to as string) || from;

    const [salesAgg, expensesAgg, customerDuesAgg] = await Promise.all([
      queryWithRetry(`
        SELECT 
          COALESCE(SUM(total_amount), 0)::float AS gross_sales,
          COALESCE(SUM(CASE WHEN sale_type = 'walk_in' AND paid_amount > 0 THEN paid_amount ELSE 0 END), 0)::float AS cash_sales,
          COALESCE(SUM(CASE WHEN sale_type = 'split' THEN paid_amount ELSE 0 END), 0)::float AS split_cash,
          COALESCE(SUM(CASE WHEN sale_type IN ('ledger_daily', 'ledger_monthly') THEN total_amount ELSE 0 END), 0)::float AS khata_sales,
          COALESCE(SUM(remaining_balance), 0)::float AS khata_dues,
          COUNT(*)::int AS bills_count
        FROM sales
        WHERE created_at::date >= $1::date AND created_at::date <= $2::date
      `, [from, to]),
      queryWithRetry(`
        SELECT COALESCE(SUM(amount), 0)::float AS total_expenses
        FROM expenses
        WHERE date::date >= $1::date AND date::date <= $2::date
      `, [from, to]),
      queryWithRetry(`
        SELECT 
          COALESCE(SUM(current_balance), 0)::float AS total_dues,
          COUNT(*)::int AS khata_customers
        FROM customers
        WHERE LOWER(status) = 'active' AND current_balance > 0
      `),
    ]);

    const s = salesAgg.rows[0] || {};
    const e = expensesAgg.rows[0] || {};
    const c = customerDuesAgg.rows[0] || {};

    const grossSales = s.gross_sales || 0;
    const cashSales = (s.cash_sales || 0) + (s.split_cash || 0);
    const khataSales = s.khata_sales || 0;
    const totalBills = s.bills_count || 0;
    const totalExpenses = e.total_expenses || 0;
    const khataDues = c.total_dues || s.khata_dues || 0;
    const khataCustomerCount = c.khata_customers || 0;
    const netSales = Math.max(0, grossSales - totalExpenses);
    const averageBill = totalBills > 0 ? Math.round((grossSales / totalBills) * 100) / 100 : 0;

    const result = {
      grossSales,
      refunds: 0,
      netSales,
      totalExpenses,
      totalBills,
      billsServed: totalBills,
      averageBill,
      cashSales,
      onlineSales: 0,
      khataSales,
      expectedCash: cashSales,
      cashCollected: cashSales,
      khataDues,
      khataCustomerCount,
    };

    return ApiResponse.success(res, 'Dashboard metrics fetched from Neon', result, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/recent-sales
router.get('/recent-sales', requireCloudScreen('Dashboard'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry(`
      SELECT 
        s.id,
        s.sale_type,
        s.customer_name,
        s.total_amount,
        s.paid_amount,
        s.remaining_balance,
        s.created_at,
        c.name AS c_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_id = c.id
      ORDER BY s.created_at DESC
      LIMIT 8
    `);

    const rows = result.rows.map((row: any) => {
      let payment: 'CASH' | 'ONLINE' | 'KHATA' = 'CASH';
      if (row.sale_type === 'ledger_daily' || row.sale_type === 'ledger_monthly') {
        payment = 'KHATA';
      }

      const d = new Date(row.created_at);
      const h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hr = h % 12 === 0 ? 12 : h % 12;
      const timeLabel = `${hr}:${m} ${ampm}`;

      const type = row.sale_type === 'walk_in' ? 'Walk-in'
        : row.sale_type === 'split' ? 'Split'
        : 'Khata';

      return {
        id: row.id,
        type,
        timeLabel,
        amount: Number(row.total_amount),
        payment,
        customerName: row.c_name || row.customer_name || null,
      };
    });

    return ApiResponse.success(res, 'Recent sales fetched from Neon', rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/khata-customers
router.get('/khata-customers', requireCloudScreen('Dashboard'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const result = await queryWithRetry(`
      SELECT 
        id,
        name,
        phone,
        current_balance,
        customer_type,
        updated_at
      FROM customers
      WHERE LOWER(status) = 'active' AND current_balance > 0
      ORDER BY current_balance DESC
      LIMIT 8
    `);

    const rows = result.rows.map((c: any) => ({
      id: c.id,
      name: c.name,
      phone: c.phone || '',
      amount: Number(c.current_balance),
      type: c.customer_type === 'monthly_ledger' ? 'Wholesale' : 'Retail',
      lastSaleDate: c.updated_at ? new Date(c.updated_at).toISOString() : null,
    }));

    return ApiResponse.success(res, 'Khata customers fetched from Neon', rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/revenue-trend?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/revenue-trend', requireCloudScreen('Dashboard'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
    const to = (req.query.to as string) || from;

    const result = await queryWithRetry(`
      SELECT 
        to_char(created_at, 'YYYY-MM-DD') AS date_key,
        COALESCE(SUM(total_amount), 0)::float AS daily_revenue
      FROM sales
      WHERE created_at::date >= $1::date AND created_at::date <= $2::date
      GROUP BY to_char(created_at, 'YYYY-MM-DD')
      ORDER BY date_key ASC
    `, [from, to]);

    const byDate: Record<string, number> = {};
    for (const row of result.rows) {
      byDate[row.date_key] = row.daily_revenue;
    }

    // Fill all dates in range
    const points: { label: string; value: number; date: string }[] = [];
    const [y1, m1, d1] = from.split('-').map(Number);
    const [y2, m2, d2] = to.split('-').map(Number);
    const cursor = new Date(y1, m1 - 1, d1);
    const end = new Date(y2, m2 - 1, d2);

    while (cursor <= end) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${d}`;
      const label = cursor.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      points.push({ label, value: byDate[dateKey] || 0, date: dateKey });
      cursor.setDate(cursor.getDate() + 1);
    }

    return ApiResponse.success(res, 'Revenue trend fetched from Neon', points, 200);
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
