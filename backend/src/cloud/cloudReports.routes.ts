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
    const from = (req.query.from as string) || '2020-01-01';
    const to = (req.query.to as string) || new Date().toISOString().split('T')[0];

    const suppliersRes = await queryWithRetry(`
      SELECT 
        s.id, s.local_id, s.name, s.phone, s.updated_at,
        COALESCE(SUM(sc.amount), 0)::float AS total_purchases,
        COALESCE(SUM(sp.amount), 0)::float AS total_paid
      FROM suppliers s
      LEFT JOIN supplier_collections sc ON s.id = sc.supplier_uuid AND sc.date >= $1 AND sc.date <= $2
      LEFT JOIN supplier_payments sp ON s.id = sp.supplier_uuid AND sp.date >= $1 AND sp.date <= $2
      GROUP BY s.id, s.local_id, s.name, s.phone, s.updated_at
      ORDER BY s.name ASC
    `, [from, to]);

    interface SupplierRow {
      id: string;
      name: string;
      phone: string;
      totalPurchases: number;
      paid: number;
      returns: number;
      incentives: number;
      outstanding: number;
      lastTransaction: string;
      status: string;
    }

    const rows: SupplierRow[] = suppliersRes.rows.map((s: any): SupplierRow => {
      const totalPurchases = Number(s.total_purchases) || 0;
      const paid = Number(s.total_paid) || 0;
      const outstanding = Math.max(0, totalPurchases - paid);
      return {
        id: String(s.local_id || s.id),
        name: s.name,
        phone: s.phone || '',
        totalPurchases,
        paid,
        returns: 0,
        incentives: 0,
        outstanding,
        lastTransaction: s.updated_at ? new Date(s.updated_at).toISOString() : new Date().toISOString(),
        status: outstanding <= 0 ? 'Cleared' : 'Pending',
      };
    });

    const summary = {
      totalSuppliers: rows.length,
      totalPurchases: rows.reduce((acc: number, r: SupplierRow) => acc + r.totalPurchases, 0),
      totalPaid: rows.reduce((acc: number, r: SupplierRow) => acc + r.paid, 0),
      totalPayable: rows.reduce((acc: number, r: SupplierRow) => acc + r.outstanding, 0),
      totalReturns: 0,
      totalIncentives: 0,
      outstandingBalance: rows.reduce((acc: number, r: SupplierRow) => acc + r.outstanding, 0),
    };

    return ApiResponse.success(res, 'Supplier report fetched', {
      summary,
      suppliers: rows,
      purchasesBySupplier: rows.map((r: SupplierRow) => ({ label: r.name.split(' ')[0], value: r.totalPurchases })),
      outstandingBySupplier: rows.filter((r: SupplierRow) => r.outstanding > 0).map((r: SupplierRow) => ({ label: r.name.split(' ')[0], value: r.outstanding })),
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/f2-sales
router.get('/f2-sales', requireCloudScreen('F2 Sales Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
    const to = (req.query.to as string) || from;

    const salesRes = await queryWithRetry(`
      SELECT 
        s.id, s.local_id, s.sale_type, s.customer_name, s.customer_phone,
        s.total_amount, s.paid_amount, s.remaining_balance, s.status, s.created_at, s.updated_at,
        c.name AS c_name
      FROM sales s
      LEFT JOIN customers c ON s.customer_uuid = c.id
      WHERE s.created_at::date >= $1::date AND s.created_at::date <= $2::date
        AND EXISTS (
          SELECT 1 FROM sale_items si 
          WHERE si.sale_uuid = s.id 
            AND LOWER(TRIM(si.item_name)) IN ('lassi', 'butter', 'ghee')
        )
      ORDER BY s.created_at DESC
    `, [from, to]);

    let netSales = 0, cashSales = 0, onlineSales = 0, splitSales = 0;
    for (const row of salesRes.rows) {
      const amt = Number(row.total_amount) || 0;
      netSales += amt;
      if (row.sale_type === 'walk_in') {
        cashSales += amt;
      } else if (row.sale_type === 'split') {
        splitSales += Number(row.paid_amount) || 0;
      }
    }

    return ApiResponse.success(res, 'F2 sales report fetched', {
      sales: salesRes.rows.map((s: any) => ({
        id: s.local_id || s.id,
        createdAt: new Date(s.created_at).toISOString(),
        saleType: s.sale_type,
        customerName: s.c_name || s.customer_name || null,
        customerPhone: s.customer_phone,
        totalAmount: Number(s.total_amount),
        paidAmount: Number(s.paid_amount),
        remainingBalance: Number(s.remaining_balance),
        status: s.status,
        updatedAt: new Date(s.updated_at).toISOString(),
        items: [],
        payments: [],
      })),
      analytics: {
        summary: { netSales, cashSales, onlineSales, splitSales, totalBills: salesRes.rows.length },
        trend: [],
        paymentMethods: [],
        categoryBreakdown: [],
      },
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/f2-item-summary
router.get('/f2-item-summary', requireCloudScreen('F2 Sales Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
    const to = (req.query.to as string) || from;

    const summaryRes = await queryWithRetry(`
      SELECT 
        LOWER(TRIM(item_name)) as item_name,
        COALESCE(SUM(quantity), 0)::float as total_quantity,
        COALESCE(SUM(total_price), 0)::float as total_amount
      FROM sale_items si
      JOIN sales s ON si.sale_uuid = s.id
      WHERE s.created_at::date >= $1::date AND s.created_at::date <= $2::date
        AND LOWER(TRIM(item_name)) IN ('lassi', 'butter', 'ghee')
      GROUP BY LOWER(TRIM(item_name))
    `, [from, to]);

    return ApiResponse.success(res, 'F2 item summary fetched', summaryRes.rows, 200);
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
