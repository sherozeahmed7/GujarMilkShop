import { Router, Response, NextFunction } from 'express';
import { queryWithRetry } from '../config/neonDb';
import { ApiResponse } from '../utils/apiResponse';
import { authenticateCloudJWT, CloudAuthRequest, requireCloudScreen } from './cloudAuth.middleware';

const router = Router();
router.use(authenticateCloudJWT);

// GET /api/reports/sales
router.get('/sales', requireCloudScreen('Sales Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string || '2026-01-01';
    const to = req.query.to as string || new Date().toISOString().split('T')[0];

    const salesRes = await queryWithRetry(`
      SELECT 
        DATE(created_at) as date,
        sale_type,
        COUNT(*)::int as bill_count,
        COALESCE(SUM(total_amount), 0)::float as total_amount,
        COALESCE(SUM(paid_amount), 0)::float as paid_amount,
        COALESCE(SUM(discount_amount), 0)::float as discount_amount,
        COALESCE(SUM(remaining_balance), 0)::float as remaining_balance
      FROM sales
      WHERE created_at >= $1 AND created_at <= ($2::date + INTERVAL '1 day')
      GROUP BY DATE(created_at), sale_type
      ORDER BY DATE(created_at) DESC
    `, [from, to]);

    // Include walk_in_daily_summaries if present
    const walkInRes = await queryWithRetry(`
      SELECT * FROM walk_in_daily_summaries
      WHERE business_date >= $1 AND business_date <= $2
      ORDER BY business_date DESC
    `, [from, to]);

    return ApiResponse.success(res, 'Sales report fetched from Neon', {
      dailyBreakdown: salesRes.rows,
      walkInSummaries: walkInRes.rows,
      from,
      to,
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/profit-loss
router.get('/profit-loss', requireCloudScreen('Profit & Loss'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string || '2026-01-01';
    const to = req.query.to as string || new Date().toISOString().split('T')[0];

    const [salesAgg, expensesAgg, walkInAgg, supplierAgg] = await Promise.all([
      queryWithRetry(`
        SELECT 
          COUNT(*)::int as count,
          COALESCE(SUM(total_amount), 0)::float as gross_sales,
          COALESCE(SUM(paid_amount), 0)::float as amount_collected,
          COALESCE(SUM(discount_amount), 0)::float as discounts,
          COALESCE(SUM(remaining_balance), 0)::float as borrowed_amount
        FROM sales
        WHERE created_at >= $1 AND created_at <= ($2::date + INTERVAL '1 day')
      `, [from, to]),
      queryWithRetry(`
        SELECT 
          COALESCE(SUM(amount), 0)::float as gross_expenses,
          COALESCE(SUM(paid_amount), 0)::float as total_expenses
        FROM expenses
        WHERE date >= $1 AND date <= $2
      `, [from, to]),
      queryWithRetry(`
        SELECT 
          COALESCE(SUM(gross_sales), 0)::float as gross_sales,
          COALESCE(SUM(cost_of_goods), 0)::float as cogs
        FROM walk_in_daily_summaries
        WHERE business_date >= $1 AND business_date <= $2
      `, [from, to]),
      queryWithRetry(`
        SELECT 
          COALESCE(SUM(amount), 0)::float as total_paid
        FROM supplier_payments
        WHERE date >= $1 AND date <= $2
      `, [from, to]),
    ]);

    const s = salesAgg.rows[0];
    const e = expensesAgg.rows[0];
    const w = walkInAgg.rows[0];
    const sup = supplierAgg.rows[0];

    const netSales = s.gross_sales - s.discounts;
    const cogs = w.cogs || 0;
    const grossProfit = netSales - cogs;
    const netProfit = grossProfit - e.total_expenses;

    const plPayload = {
      summary: {
        grossSales: s.gross_sales,
        discounts: s.discounts,
        returns: 0,
        netSales,
        cogs,
        grossProfit,
        grossMargin: netSales > 0 ? ((grossProfit / netSales) * 100).toFixed(2) : 0,
        totalExpenses: e.total_expenses,
        shopExpenses: e.total_expenses,
        totalSupplierPaid: sup.total_paid,
        netProfit,
        netProfitMargin: netSales > 0 ? ((netProfit / netSales) * 100).toFixed(2) : 0,
        amountCollected: s.amount_collected,
        borrowedAmount: s.borrowed_amount,
        numberOfSales: s.count,
        numberOfReturns: 0,
      },
      dateRange: { from, to },
      cloudNotice: 'Generated directly from Neon Cloud PostgreSQL mirror.',
    };

    return ApiResponse.success(res, 'Profit & Loss fetched from Neon', plPayload, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/suppliers
router.get('/suppliers', requireCloudScreen('Supplier Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string || '2026-01-01';
    const to = req.query.to as string || new Date().toISOString().split('T')[0];

    const resCols = await queryWithRetry(`
      SELECT 
        s.name, s.code,
        COUNT(sc.id)::int as collections_count,
        COALESCE(SUM(sc.quantity), 0)::float as total_kg,
        COALESCE(SUM(sc.amount), 0)::float as total_amount
      FROM suppliers s
      LEFT JOIN supplier_collections sc ON s.id = sc.supplier_uuid AND sc.date >= $1 AND sc.date <= $2
      GROUP BY s.id, s.name, s.code
      ORDER BY total_amount DESC
    `, [from, to]);

    return ApiResponse.success(res, 'Supplier report fetched', resCols.rows, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/customers
router.get('/customers', requireCloudScreen('Customer Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const resCust = await queryWithRetry(`
      SELECT 
        c.name, c.phone, c.customer_type,
        COUNT(s.id)::int as total_orders,
        COALESCE(SUM(s.total_amount), 0)::float as total_billed,
        COALESCE(SUM(s.paid_amount), 0)::float as total_paid,
        COALESCE(SUM(s.remaining_balance), 0)::float as total_due
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_uuid
      GROUP BY c.id, c.name, c.phone, c.customer_type
      ORDER BY total_billed DESC
      LIMIT 100
    `);

    return ApiResponse.success(res, 'Customer report fetched', resCust.rows, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
