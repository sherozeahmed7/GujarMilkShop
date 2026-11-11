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

// GET /api/reports/expenses
router.get('/expenses', requireCloudScreen('Expenses Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = (req.query.from as string) || '2020-01-01';
    const to = (req.query.to as string) || new Date().toISOString().split('T')[0];
    const typeParam = req.query.type ? String(req.query.type).toUpperCase() : undefined;

    let query = 'SELECT * FROM expenses WHERE date >= $1 AND date <= $2';
    const params: any[] = [from, to];
    if (typeParam && typeParam !== 'COMBINED') {
      query += ' AND expense_type = $3';
      params.push(typeParam);
    }
    query += ' ORDER BY date DESC';

    const result = await queryWithRetry(query, params);
    const periodExp = result.rows;

    const totalAmount = periodExp.reduce((s: number, e: any) => s + (Number(e.amount || e.net_expense) || 0), 0);
    const totalPaid = periodExp.reduce((s: number, e: any) => s + (Number(e.paid_amount) || 0), 0);
    const totalRemaining = periodExp.reduce((s: number, e: any) => s + (Number(e.remaining) || 0), 0);

    const catTotals: Record<string, number> = {};
    for (const e of periodExp) {
      const amt = Number(e.amount || e.net_expense) || 0;
      catTotals[e.category] = (catTotals[e.category] || 0) + amt;
    }
    const byCategory = Object.entries(catTotals).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

    const periodShop = periodExp.filter((e: any) => (e.expense_type || 'SHOP') === 'SHOP');
    const periodPersonal = periodExp.filter((e: any) => e.expense_type === 'PERSONAL');

    const shopExpenses = periodShop.reduce((s: number, e: any) => s + (Number(e.amount || e.net_expense) || 0), 0);
    const shopPaid = periodShop.reduce((s: number, e: any) => s + (Number(e.paid_amount) || 0), 0);
    const shopRemaining = periodShop.reduce((s: number, e: any) => s + (Number(e.remaining) || 0), 0);

    const personalExpenses = periodPersonal.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);
    const personalReceived = periodPersonal.reduce((s: number, e: any) => s + (Number(e.paid_amount) || 0), 0);
    const personalRemaining = periodPersonal.reduce((s: number, e: any) => s + (Number(e.remaining) || 0), 0);

    return ApiResponse.success(res, 'Expenses report fetched', {
      summary: {
        totalExpenses: periodExp.length,
        totalAmount,
        totalPaid,
        totalRemaining,
        avgExpense: periodExp.length ? Math.round(totalAmount / periodExp.length) : 0,
        todayAmount: 0,
        thisWeekAmount: 0,
        thisMonthAmount: 0,
        cashExpenses: totalPaid,
        topCategory: byCategory[0]?.label || '—',
        shopExpenses,
        shopPaid,
        shopRemaining,
        personalExpenses,
        personalReceived,
        personalRemaining,
      },
      expenses: periodExp.map((e: any) => ({
        id: String(e.local_id || e.id),
        date: e.date,
        category: e.category,
        description: e.description || e.category,
        amount: Number(e.amount || e.net_expense || 0),
        paidAmount: Number(e.paid_amount || 0),
        remaining: Number(e.remaining || 0),
        paymentMethod: 'Cash',
        addedBy: e.added_by || 'Admin',
        expenseType: e.expense_type || 'SHOP',
        status: Number(e.remaining || 0) <= 0 ? 'Settled' : Number(e.paid_amount || 0) > 0 ? 'Partial' : 'Pending',
      })),
      byCategory,
      dailyTrend: [],
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/returns
router.get('/returns', requireCloudScreen('Returns Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = (req.query.from as string) || '2020-01-01';
    const to = (req.query.to as string) || new Date().toISOString().split('T')[0];

    const result = await queryWithRetry('SELECT * FROM returns WHERE date >= $1 AND date <= $2 ORDER BY created_at DESC', [from, to]);
    const returns = result.rows;
    const returnAmount = returns.reduce((s: number, r: any) => s + (Number(r.refund_amount) || 0), 0);
    const cashRefunds = returns.filter((r: any) => r.payment_method === 'Cash').reduce((s: number, r: any) => s + (Number(r.refund_amount) || 0), 0);

    return ApiResponse.success(res, 'Returns report fetched', {
      summary: {
        totalReturns: returns.length,
        returnAmount,
        cashRefunds,
        creditRefunds: Math.max(0, returnAmount - cashRefunds),
        returnedBills: returns.length,
        returnedItems: 0,
      },
      returns: returns.map((r: any) => ({
        id: `RET-${String(r.local_id || r.id).padStart(4, '0')}`,
        originalSaleId: r.bill_number,
        date: r.date,
        customer: r.customer,
        items: 0,
        amount: Number(r.refund_amount || 0),
        refundMethod: r.payment_method === 'Cash' ? 'Cash' : 'Credit Adjustment',
        reason: r.reason || '',
        createdBy: r.processed_by || 'Admin',
        status: r.status,
      })),
      dailyTrend: [],
      byCategory: [],
      byReason: [],
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/shifts
router.get('/shifts', requireCloudScreen('Shifts Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = (req.query.from as string) || '2020-01-01';
    const to = (req.query.to as string) || new Date().toISOString().split('T')[0];

    const result = await queryWithRetry(`
      SELECT s.*, u_open.name AS opened_by_name, u_close.name AS closed_by_name
      FROM shifts s
      LEFT JOIN users u_open ON s.opened_by_uuid = u_open.id
      LEFT JOIN users u_close ON s.closed_by_uuid = u_close.id
      WHERE s.shift_date >= $1 AND s.shift_date <= $2
      ORDER BY s.opened_at DESC
    `, [from, to]);

    const shifts = result.rows.map((s: any) => ({
      id: String(s.local_id || s.id),
      date: s.shift_date,
      openedBy: s.opened_by_name || 'System',
      openedAt: s.opened_at ? new Date(s.opened_at).toISOString() : '',
      closedBy: s.closed_by_name || null,
      closedAt: s.closed_at ? new Date(s.closed_at).toISOString() : null,
      openingCash: Number(s.opening_cash || 0),
      expectedCash: Number(s.expected_cash || 0),
      countedCash: s.counted_cash !== null ? Number(s.counted_cash) : 0,
      difference: s.difference !== null ? Number(s.difference) : 0,
      differenceStatus: s.difference_status || 'Balanced',
      status: s.status,
      billsCount: 0,
      grossSales: 0,
      cashSales: 0,
      onlineSales: 0,
      khataSales: 0,
    }));

    return ApiResponse.success(res, 'Shifts report fetched', {
      summary: {
        totalShifts: shifts.length,
        openShifts: shifts.filter((s: any) => s.status === 'Open').length,
        closedShifts: shifts.filter((s: any) => s.status === 'Closed').length,
        totalHours: 0,
        openingCash: shifts.reduce((s: number, sh: any) => s + sh.openingCash, 0),
        expectedCash: shifts.reduce((s: number, sh: any) => s + sh.expectedCash, 0),
        countedCash: shifts.reduce((s: number, sh: any) => s + (sh.countedCash || 0), 0),
        totalVariance: shifts.reduce((s: number, sh: any) => s + (sh.difference || 0), 0),
      },
      shifts,
      salesByShift: [],
      byCashier: [],
      varianceByShift: [],
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/cash-register
router.get('/cash-register', requireCloudScreen('Cash Register Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = (req.query.from as string) || '2020-01-01';
    const to = (req.query.to as string) || new Date().toISOString().split('T')[0];

    const result = await queryWithRetry(`
      SELECT s.*, u_open.name AS opened_by_name
      FROM shifts s
      LEFT JOIN users u_open ON s.opened_by_uuid = u_open.id
      WHERE s.shift_date >= $1 AND s.shift_date <= $2
      ORDER BY s.opened_at ASC
    `, [from, to]);

    const history = result.rows.map((s: any) => ({
      shiftId: String(s.local_id || s.id),
      date: s.shift_date,
      cashier: s.opened_by_name || 'System',
      openingBalance: Number(s.opening_cash || 0),
      cashSales: 0,
      cashReceived: 0,
      cashOut: 0,
      expectedCash: Number(s.expected_cash || 0),
      actualCash: Number(s.counted_cash || s.expected_cash || 0),
      difference: Number(s.difference || 0),
      status: s.difference_status || 'Balanced',
      closingNotes: s.closing_notes || '',
    }));

    return ApiResponse.success(res, 'Cash register report fetched', {
      summary: {},
      history,
      movementData: [],
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/inventory
router.get('/inventory', requireCloudScreen('Inventory Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const [productsRes, collectionsRes] = await Promise.all([
      queryWithRetry('SELECT * FROM inventory_products ORDER BY name ASC'),
      queryWithRetry(`
        SELECT sc.*, s.name AS supplier_name, s.code AS supplier_code
        FROM supplier_collections sc
        LEFT JOIN suppliers s ON sc.supplier_uuid = s.id
        ORDER BY sc.date DESC
        LIMIT 100
      `),
    ]);

    const rows = productsRes.rows.map((p: any) => ({
      sku: p.code,
      name: p.name,
      category: p.category,
      stock: 0,
      costPrice: 0,
      salePrice: 0,
      inventoryValue: 0,
      retailValue: 0,
      stockStatus: 'In Stock',
      supplier: 'All',
    }));

    const supplierMilkReceipts = collectionsRes.rows.map((sc: any) => ({
      id: String(sc.local_id || sc.id),
      date: sc.date,
      supplierId: String(sc.supplier_uuid),
      supplierName: sc.supplier_name || 'Unknown',
      supplierCode: sc.supplier_code || '',
      shift: sc.shift,
      milkType: sc.milk_type,
      quantity: Number(sc.quantity),
      rate: Number(sc.rate),
      purchaseCost: Number(sc.amount),
    }));

    const totalMilkReceived = supplierMilkReceipts.reduce((s: number, r: any) => s + r.quantity, 0);
    const totalMilkCost = supplierMilkReceipts.reduce((s: number, r: any) => s + r.purchaseCost, 0);

    return ApiResponse.success(res, 'Inventory report fetched', {
      summary: {
        totalProducts: rows.length,
        totalStock: 0,
        lowStockItems: 0,
        outOfStockItems: 0,
        inventoryValue: 0,
        costValue: 0,
        estimatedRetailValue: 0,
        totalMilkReceived,
        totalMilkCost,
        averageMilkRate: totalMilkReceived > 0 ? Math.round((totalMilkCost / totalMilkReceived) * 100) / 100 : 0,
        supplierReceiptCount: supplierMilkReceipts.length,
      },
      products: rows,
      categories: ['Dairy'],
      suppliers: [],
      supplierOptions: [],
      supplierMilkReceipts,
      stockByCategory: [],
      valueByCategory: [],
      lowStockProducts: [],
      topSellingProducts: [],
    }, 200);
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/customers
router.get('/customers', requireCloudScreen('Customer Report'), async (req: CloudAuthRequest, res: Response, next: NextFunction) => {
  try {
    const from = (req.query.from as string) || '2020-01-01';
    const to = (req.query.to as string) || new Date().toISOString().split('T')[0];

    const resCust = await queryWithRetry(`
      SELECT 
        c.id, c.local_id, c.name, c.phone, c.customer_type, c.status, c.updated_at,
        COUNT(s.id)::int as total_orders,
        COALESCE(SUM(s.total_amount), 0)::float as total_billed,
        COALESCE(SUM(s.paid_amount), 0)::float as total_paid,
        COALESCE(SUM(s.remaining_balance), 0)::float as total_due
      FROM customers c
      LEFT JOIN sales s ON c.id = s.customer_uuid AND s.created_at::date >= $1::date AND s.created_at::date <= $2::date
      GROUP BY c.id, c.local_id, c.name, c.phone, c.customer_type, c.status, c.updated_at
      ORDER BY total_billed DESC
    `, [from, to]);

    const rows = resCust.rows.map((c: any) => ({
      id: c.local_id || c.id,
      name: c.name,
      phone: c.phone || '',
      totalSales: Number(c.total_billed || 0),
      paid: Number(c.total_paid || 0),
      credit: Number(c.total_billed || 0),
      outstanding: Number(c.total_due || 0),
      lastPurchase: c.updated_at ? new Date(c.updated_at).toISOString() : new Date().toISOString(),
      isActive: c.status === 'active',
    }));

    const summary = {
      totalCustomers: rows.length,
      activeCustomers: rows.filter((c: any) => c.isActive).length,
      totalCustomerSales: rows.reduce((s: number, c: any) => s + c.totalSales, 0),
      totalCollected: rows.reduce((s: number, c: any) => s + c.paid, 0),
      totalOutstanding: rows.reduce((s: number, c: any) => s + c.outstanding, 0),
      creditSales: rows.reduce((s: number, c: any) => s + c.credit, 0),
      customerReturns: 0,
    };

    return ApiResponse.success(res, 'Customer report fetched', {
      summary,
      customers: rows,
      trendData: [],
      topCustomers: rows.slice(0, 5).map((c: any) => ({ label: c.name.split(' ')[0], value: c.totalSales })),
      outstandingChart: rows.filter((c: any) => c.outstanding > 0).map((c: any) => ({ label: c.name.split(' ')[0], value: c.outstanding })),
    }, 200);
  } catch (err) {
    next(err);
  }
});

export default router;
