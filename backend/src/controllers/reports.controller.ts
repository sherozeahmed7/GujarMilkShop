import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const money = (n: number) => Math.round(n * 100) / 100;

function toYMD(d: Date) { return d.toISOString().split('T')[0]; }
function dayLabel(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item); (acc[k] = acc[k] || []).push(item); return acc;
  }, {} as Record<string, T[]>);
}
function rangeBounds(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return { start: new Date(fy, fm - 1, fd, 0, 0, 0, 0), end: new Date(ty, tm - 1, td, 23, 59, 59, 999) };
}
function parseRange(req: AuthenticatedRequest) {
  const today = toYMD(new Date());
  const from = (req.query.from as string) || today;
  const to   = (req.query.to   as string) || today;
  return { from, to, ...rangeBounds(from, to) };
}
function fillDailyTrend(from: string, to: string, byDate: Record<string, number>) {
  const points: { label: string; value: number }[] = [];
  const cursor = new Date(from + 'T12:00:00');
  const endD   = new Date(to   + 'T12:00:00');
  while (cursor <= endD) {
    const key = toYMD(cursor);
    points.push({ label: dayLabel(key), value: byDate[key] || 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return points;
}

// ── EXPENSES REPORT ───────────────────────────────────────────────────────────
export class ReportsController {
  static async expenses(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to, start, end } = parseRange(req);
      const today = toYMD(new Date());
      const weekStart = toYMD(new Date(new Date().setDate(new Date().getDate() - 6)));
      const monthStart = toYMD(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

      const [allExp, periodExp] = await Promise.all([
        prisma.expense.findMany({ orderBy: { date: 'desc' } }),
        prisma.expense.findMany({ where: { date: { gte: from, lte: to } }, orderBy: { date: 'desc' } }),
      ]);

      const totalAmount = money(periodExp.reduce((s, e) => s + e.netExpense, 0));
      const catTotals: Record<string, number> = {};
      const byDate: Record<string, number> = {};
      for (const e of periodExp) {
        catTotals[e.category] = money((catTotals[e.category] || 0) + e.netExpense);
        byDate[e.date] = money((byDate[e.date] || 0) + e.netExpense);
      }
      const byCategory = Object.entries(catTotals).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
      const topCategory = byCategory[0]?.label || '—';

      const fmt = (list: typeof allExp) => list.reduce((s, e) => s + e.netExpense, 0);

      return ApiResponse.success(res, 'Expenses report.', {
        summary: {
          totalExpenses: periodExp.length,
          totalAmount,
          avgExpense: periodExp.length ? money(totalAmount / periodExp.length) : 0,
          todayAmount:    money(fmt(allExp.filter(e => e.date === today))),
          thisWeekAmount: money(fmt(allExp.filter(e => e.date >= weekStart))),
          thisMonthAmount:money(fmt(allExp.filter(e => e.date >= monthStart))),
          cashExpenses:   money(fmt(periodExp.filter(e => !e.description?.toLowerCase().includes('bank')))),
          bankExpenses:   0,
          topCategory,
        },
        expenses: periodExp.map(e => ({
          id: String(e.id), date: e.date, category: e.category,
          description: e.description || e.category,
          amount: money(e.netExpense),
          paymentMethod: 'Cash',
          addedBy: e.addedBy,
          status: 'Paid',
        })),
        byCategory,
        dailyTrend: fillDailyTrend(from, to, byDate),
      });
    } catch (err) { next(err); }
  }

  // ── RETURNS REPORT ──────────────────────────────────────────────────────────
  static async returns(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseRange(req);

      const returns = await prisma.return.findMany({
        where: { date: { gte: from, lte: to } },
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });

      const returnAmount = money(returns.reduce((s, r) => s + r.refundAmount, 0));
      const cashRefunds  = money(returns.filter(r => r.paymentMethod === 'Cash').reduce((s, r) => s + r.refundAmount, 0));
      const byDate:   Record<string, number> = {};
      const byCat:    Record<string, number> = {};
      const byReason: Record<string, number> = {};

      for (const r of returns) {
        byDate[r.date]   = money((byDate[r.date]   || 0) + r.refundAmount);
        byCat['General'] = money((byCat['General'] || 0) + r.refundAmount);
        byReason[r.reason] = (byReason[r.reason] || 0) + 1;
      }

      return ApiResponse.success(res, 'Returns report.', {
        summary: {
          totalReturns: returns.length,
          returnAmount,
          cashRefunds,
          creditRefunds: money(returnAmount - cashRefunds),
          returnedBills: returns.length,
          returnedItems: returns.reduce((s, r) => s + (r.items?.length || 0), 0),
        },
        returns: returns.map(r => ({
          id: `RET-${String(r.id).padStart(4, '0')}`,
          originalSaleId: r.billNumber,
          date: r.date,
          customer: r.customer,
          items: r.items?.length || 0,
          amount: r.refundAmount,
          refundMethod: r.paymentMethod === 'Cash' ? 'Cash' : 'Credit Adjustment',
          reason: r.reason,
          createdBy: r.processedBy,
          status: r.status,
        })),
        dailyTrend: fillDailyTrend(from, to, byDate),
        byCategory:  Object.entries(byCat).map(([label, value]) => ({ label, value })),
        byReason:    Object.entries(byReason).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
      });
    } catch (err) { next(err); }
  }

  // ── SHIFTS REPORT ───────────────────────────────────────────────────────────
  static async shifts(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to, start, end } = parseRange(req);

      const shifts = await prisma.shift.findMany({
        where: { shiftDate: { gte: from, lte: to } },
        include: { openedBy: true, closedBy: true },
        orderBy: { shiftDate: 'desc' },
      });

      // Aggregate sales per shift window
      const shiftRows = await Promise.all(shifts.map(async (s) => {
        const shiftEnd = s.closedAt ?? new Date();
        const sales = await prisma.sale.findMany({
          where: { createdAt: { gte: s.openedAt, lte: shiftEnd } },
          include: { payments: true },
        });
        let cashSales = 0;
        for (const sale of sales) {
          if (sale.saleType === 'walk_in' && sale.payments[0]?.method === 'cash') cashSales += sale.totalAmount;
          if (sale.saleType === 'split') cashSales += (sale.payments[0]?.amount ?? 0);
        }
        const durationH = s.closedAt
          ? Math.round((s.closedAt.getTime() - s.openedAt.getTime()) / 3600000)
          : 0;
        return {
          id: `SHIFT-${s.shiftDate}`,
          date: s.shiftDate,
          openedBy: s.openedBy.name || s.openedBy.email,
          openTime: s.openedAt.toISOString(),
          closedBy: s.closedBy?.name || s.closedBy?.email || '—',
          closeTime: s.closedAt?.toISOString() || '',
          openingCash: s.openingCash,
          cashSales: money(cashSales),
          expectedCash: s.expectedCash,
          countedCash: s.countedCash ?? 0,
          variance: s.difference ?? 0,
          durationHours: durationH,
          status: s.status,
        };
      }));

      const cashierMap: Record<string, { sales: number; hours: number; shifts: number }> = {};
      for (const s of shiftRows) {
        if (!cashierMap[s.openedBy]) cashierMap[s.openedBy] = { sales: 0, hours: 0, shifts: 0 };
        cashierMap[s.openedBy].sales  += s.cashSales;
        cashierMap[s.openedBy].hours  += s.durationHours;
        cashierMap[s.openedBy].shifts += 1;
      }

      return ApiResponse.success(res, 'Shifts report.', {
        summary: {
          totalShifts:  shiftRows.length,
          openShifts:   shiftRows.filter(s => s.status === 'Open').length,
          closedShifts: shiftRows.filter(s => s.status === 'Closed').length,
          totalHours:   shiftRows.reduce((s, r) => s + r.durationHours, 0),
          openingCash:  shiftRows.length ? shiftRows[shiftRows.length - 1].openingCash : 0,
          expectedCash: money(shiftRows.reduce((s, r) => s + r.expectedCash, 0)),
          countedCash:  money(shiftRows.reduce((s, r) => s + r.countedCash, 0)),
          totalVariance:money(shiftRows.reduce((s, r) => s + Math.abs(r.variance), 0)),
        },
        shifts: shiftRows,
        salesByShift:   shiftRows.slice(0, 10).map(s => ({ label: s.id, value: s.cashSales })),
        byCashier:      Object.entries(cashierMap).map(([label, d]) => ({ label, value: d.sales })),
        varianceByShift:shiftRows.slice(0, 10).map(s => ({ label: s.id, value: Math.abs(s.variance) })),
      });
    } catch (err) { next(err); }
  }

  // ── CASH REGISTER REPORT ────────────────────────────────────────────────────
  static async cashRegister(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to, start, end } = parseRange(req);

      const shifts = await prisma.shift.findMany({
        where: { shiftDate: { gte: from, lte: to } },
        include: { openedBy: true, closedBy: true },
        orderBy: { shiftDate: 'asc' },
      });

      const history = await Promise.all(shifts.map(async (s) => {
        const shiftEnd = s.closedAt ?? new Date();
        const [sales, expenses] = await Promise.all([
          prisma.sale.findMany({ where: { createdAt: { gte: s.openedAt, lte: shiftEnd } }, include: { payments: true } }),
          prisma.expense.findMany({ where: { date: s.shiftDate } }),
        ]);
        let cashSales = 0;
        for (const sale of sales) {
          if (sale.saleType === 'walk_in' && sale.payments[0]?.method === 'cash') cashSales += sale.totalAmount;
          if (sale.saleType === 'split') cashSales += (sale.payments[0]?.amount ?? 0);
        }
        const expenseTotal = expenses.reduce((sum, e) => sum + e.netExpense, 0);
        return {
          id: `REG-${s.shiftDate}`,
          date: s.shiftDate,
          cashier: s.openedBy.name || s.openedBy.email,
          openingCash: s.openingCash,
          cashSales:   money(cashSales),
          cashIn:      0,
          cashOut:     0,
          expenses:    money(expenseTotal),
          refunds:     0,
          expectedCash:s.expectedCash,
          countedCash: s.countedCash ?? 0,
          variance:    s.difference ?? 0,
          closingCash: s.countedCash ?? 0,
          status:      s.differenceStatus === 'Balanced' ? 'Balanced' : 'Variance',
        };
      }));

      const totals = {
        openingCash:  history.length ? history[0].openingCash : 0,
        cashSales:    money(history.reduce((s, r) => s + r.cashSales, 0)),
        cashIn:       0, cashOut: 0,
        expenses:     money(history.reduce((s, r) => s + r.expenses, 0)),
        refunds:      0,
        expectedCash: money(history.reduce((s, r) => s + r.expectedCash, 0)),
        countedCash:  money(history.reduce((s, r) => s + r.countedCash, 0)),
        variance:     money(history.reduce((s, r) => s + r.variance, 0)),
        closingCash:  history.length ? history[history.length - 1].closingCash : 0,
      };

      const movementData = [...history].slice(0, 14).map(r => ({
        label: dayLabel(r.date),
        cashIn:   r.cashSales,
        cashOut:  r.expenses,
        expected: r.expectedCash,
        actual:   r.countedCash,
      }));

      return ApiResponse.success(res, 'Cash register report.', { summary: totals, history, movementData });
    } catch (err) { next(err); }
  }

  // ── CUSTOMER REPORT ─────────────────────────────────────────────────────────
  static async customers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseRange(req);

      const customers = await prisma.customer.findMany({
        include: {
          sales: {
            include: { payments: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      // Period filter for sales amounts shown in report
      const fromDate = new Date(from + 'T00:00:00');
      const toDate   = new Date(to   + 'T23:59:59');

      const rows = customers.map(c => {
        const periodSales  = c.sales.filter(s => s.createdAt >= fromDate && s.createdAt <= toDate);
        const totalSales   = money(periodSales.reduce((s, x) => s + x.totalAmount, 0));
        const paid         = money(periodSales.reduce((s, x) => s + x.paidAmount, 0));
        const credit       = totalSales;
        // Outstanding = ALL-time remaining balance (not period-filtered)
        const outstanding  = money(c.sales.filter(s => s.remainingBalance > 0).reduce((s, x) => s + x.remainingBalance, 0));
        const lastSale     = c.sales.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        return {
          id: c.id, name: c.name, phone: c.phone || '',
          totalSales, paid, credit, outstanding,
          lastPurchase: lastSale?.createdAt.toISOString() || c.updatedAt.toISOString(),
          isActive: c.status === 'active',
        };
      }).filter(c => c.totalSales > 0 || c.outstanding > 0);

      rows.sort((a, b) => b.totalSales - a.totalSales);

      const byDate: Record<string, number> = {};
      for (const c of customers) {
        const periodSalesForTrend = c.sales.filter(s => s.createdAt >= new Date(from + 'T00:00:00') && s.createdAt <= new Date(to + 'T23:59:59'));
        for (const s of periodSalesForTrend) {
          const key = toYMD(s.createdAt);
          byDate[key] = money((byDate[key] || 0) + s.totalAmount);
        }
      }

      return ApiResponse.success(res, 'Customer report.', {
        summary: {
          totalCustomers:     customers.length,
          activeCustomers:    customers.filter(c => c.status === 'active').length,
          totalCustomerSales: money(rows.reduce((s, c) => s + c.totalSales, 0)),
          totalCollected:     money(rows.reduce((s, c) => s + c.paid, 0)),
          totalOutstanding:   money(rows.reduce((s, c) => s + c.outstanding, 0)),
          creditSales:        money(rows.reduce((s, c) => s + c.credit, 0)),
          customerReturns:    0,
        },
        customers: rows,
        trendData: fillDailyTrend(from, to, byDate),
        topCustomers: rows.slice(0, 5).map(c => ({ label: c.name.split(' ')[0], value: c.totalSales })),
        outstandingChart: rows.filter(c => c.outstanding > 0).map(c => ({ label: c.name.split(' ')[0], value: c.outstanding })),
      });
    } catch (err) { next(err); }
  }

  // ── SUPPLIER REPORT ─────────────────────────────────────────────────────────
  static async suppliers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseRange(req);
      const suppliers = await prisma.supplier.findMany({
        include: {
          collections: { where: { date: { gte: from, lte: to } } },
          payments: { where: { date: { gte: from, lte: to } } },
        },
        orderBy: { name: 'asc' },
      });

      const rows = suppliers.map(s => {
        const totalPurchases = money(s.collections.reduce((sum, c) => sum + c.amount, 0));
        const paid           = money(s.payments.reduce((sum, p) => sum + p.amount, 0));
        const outstanding    = money(Math.max(0, totalPurchases - paid));
        const allDates       = [...s.collections.map(c => c.date), ...s.payments.map(p => p.date)].sort().reverse();
        return {
          id: String(s.id), name: s.name, phone: s.phone || '',
          totalPurchases, paid,
          returns:      0,
          incentives:   0,
          outstanding,
          lastTransaction: allDates[0] ? new Date(allDates[0] + 'T12:00:00').toISOString() : s.updatedAt.toISOString(),
          status: outstanding <= 0 ? 'Cleared' : 'Pending',
        };
      });

      return ApiResponse.success(res, 'Supplier report.', {
        summary: {
          totalSuppliers:     rows.length,
          totalPurchases:     money(rows.reduce((s, r) => s + r.totalPurchases, 0)),
          totalPaid:          money(rows.reduce((s, r) => s + r.paid, 0)),
          totalPayable:       money(rows.reduce((s, r) => s + r.outstanding, 0)),
          totalReturns:       0,
          totalIncentives:    0,
          outstandingBalance: money(rows.reduce((s, r) => s + r.outstanding, 0)),
        },
        suppliers: rows,
        purchasesBySupplier:   rows.map(r => ({ label: r.name.split(' ')[0], value: r.totalPurchases })),
        outstandingBySupplier: rows.filter(r => r.outstanding > 0).map(r => ({ label: r.name.split(' ')[0], value: r.outstanding })),
      });
    } catch (err) { next(err); }
  }

  // ── INVENTORY REPORT ────────────────────────────────────────────────────────
  static async inventory(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const products = await prisma.inventoryProduct.findMany({
        where: { isActive: true },
        include: { movements: true },
        orderBy: { name: 'asc' },
      });
      const rate = await prisma.dailyRate.findFirst({ orderBy: { id: 'desc' } });

      const rows = products.map(p => {
        const stock     = p.movements.reduce((s, m) => s + m.quantity, 0);
        const costRows  = p.movements.filter(m => m.unitCost && m.unitCost > 0);
        const costPrice = costRows.length ? money(costRows.reduce((s, m) => s + (m.unitCost || 0), 0) / costRows.length) : 0;
        const name = p.name.toLowerCase();
        const salePrice = name.includes('milk')
          ? rate?.milkRate || 0
          : name.includes('yogurt')
            ? rate?.yogurtRate || 0
            : name.includes('lassi')
              ? rate?.lassiRate || 0
              : name.includes('butter')
                ? rate?.butterRate || 0
                : name.includes('ghee')
                  ? rate?.gheeRate || 0
                  : costPrice;
        const stockStatus = stock <= 0 ? 'Out of Stock' : stock <= p.lowStockThreshold ? 'Low Stock' : 'In Stock';
        const lastMove  = p.movements.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
        return {
          sku: p.code, name: p.name, category: p.category,
          supplier: 'N/A', stock: money(stock), costPrice, salePrice,
          inventoryValue: money(stock * costPrice),
          retailValue:    money(stock * salePrice),
          stockStatus,
          lastUpdated: lastMove?.date?.toISOString() || p.updatedAt.toISOString(),
        };
      });

      const categories = [...new Set(rows.map(r => r.category))];
      const suppliersSet = [...new Set(rows.map(r => r.supplier))];
      const valueByCategory: Record<string, number> = {};
      const stockByCategory: Record<string, number> = {};
      rows.forEach(r => {
        valueByCategory[r.category] = money((valueByCategory[r.category] || 0) + r.inventoryValue);
        stockByCategory[r.category] = money((stockByCategory[r.category] || 0) + r.stock);
      });

      return ApiResponse.success(res, 'Inventory report.', {
        summary: {
          totalProducts:        rows.length,
          totalStock:           money(rows.reduce((s, r) => s + r.stock, 0)),
          lowStockItems:        rows.filter(r => r.stockStatus === 'Low Stock').length,
          outOfStockItems:      rows.filter(r => r.stockStatus === 'Out of Stock').length,
          inventoryValue:       money(rows.reduce((s, r) => s + r.inventoryValue, 0)),
          costValue:            money(rows.reduce((s, r) => s + r.inventoryValue, 0)),
          estimatedRetailValue: money(rows.reduce((s, r) => s + r.retailValue, 0)),
        },
        products: rows,
        categories,
        suppliers: suppliersSet,
        stockByCategory:  Object.entries(stockByCategory).map(([label, value]) => ({ label, value })),
        valueByCategory:  Object.entries(valueByCategory).map(([label, value]) => ({ label, value })),
        lowStockProducts: rows.filter(r => r.stockStatus !== 'In Stock').map(r => ({ label: r.name.split(' ')[0], value: r.stock, max: 0 })),
        topSellingProducts: [],
      });
    } catch (err) { next(err); }
  }

  // ── PROFIT & LOSS REPORT ────────────────────────────────────────────────────
  static async profitLoss(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseRange(req);

      const [sales, returns, expenses] = await Promise.all([
        prisma.sale.findMany({ where: { status: { not: 'voided' }, createdAt: { gte: new Date(from + 'T00:00:00'), lte: new Date(to + 'T23:59:59') } }, include: { items: true } }),
        prisma.return.findMany({ where: { date: { gte: from, lte: to } } }),
        prisma.expense.findMany({ where: { date: { gte: from, lte: to } } }),
      ]);

      const grossSales  = money(sales.reduce((s, x) => s + x.totalAmount, 0));
      const discounts   = 0;
      const returnsAmt  = money(returns.reduce((s, r) => s + r.refundAmount, 0));
      const netSales    = money(grossSales - discounts - returnsAmt);

      // COGS: use average supplier collection rate as cost price
      const avgCostResult = await prisma.supplierCollection.aggregate({
        _avg: { rate: true },
        where: { rate: { gt: 0 } },
      });
      const rate = await prisma.dailyRate.findFirst({ orderBy: { id: 'desc' } });
      const avgSupplierCost = avgCostResult._avg.rate || ((rate?.milkRate || 100) * 0.65);

      let cogs = 0;
      const costByDate: Record<string, number> = {};
      for (const sale of sales) {
        const saleDate = toYMD(sale.createdAt);
        for (const item of sale.items) {
          let costPerUnit: number;
          if (item.itemName === 'milk') costPerUnit = avgSupplierCost;
          else if (item.itemName === 'yogurt') costPerUnit = avgSupplierCost * 1.1; // yogurt slightly higher
          else if (['butter', 'ghee'].includes(item.itemName)) costPerUnit = item.unitPrice * 0.75;
          else costPerUnit = item.unitPrice * 0.65; // lassi
          const itemCost = money(item.quantity * costPerUnit);
          cogs += itemCost;
          costByDate[saleDate] = money((costByDate[saleDate] || 0) + itemCost);
        }
      }
      cogs = money(cogs);
      const wastage   = money(cogs * 0.03);
      const totalCosts= money(cogs + wastage);
      const grossProfit = money(netSales - totalCosts);

      const expByCategory: Record<string, number> = {};
      let operatingExpenses = 0;
      for (const e of expenses) {
        expByCategory[e.category] = money((expByCategory[e.category] || 0) + e.netExpense);
        operatingExpenses += e.netExpense;
      }
      operatingExpenses = money(operatingExpenses);
      const netProfit = money(grossProfit - operatingExpenses);
      const margin    = netSales > 0 ? parseFloat(((netProfit / netSales) * 100).toFixed(2)) : 0;

      // Daily trend
      const byDate: Record<string, number> = {};
      for (const sale of sales) {
        const key = toYMD(sale.createdAt);
        byDate[key] = money((byDate[key] || 0) + sale.totalAmount);
      }
      const dailyRevenue = fillDailyTrend(from, to, byDate);
      const dateKeys: string[] = [];
      const dateCursor = new Date(`${from}T12:00:00`);
      const dateEnd = new Date(`${to}T12:00:00`);
      while (dateCursor <= dateEnd) {
        dateKeys.push(toYMD(dateCursor));
        dateCursor.setDate(dateCursor.getDate() + 1);
      }
      const revVsCost = dailyRevenue.map((p, index) => {
        const key = dateKeys[index];
        const dailyCogs = costByDate[key] || 0;
        return { label: p.label, revenue: p.value, cost: money(dailyCogs * 1.03) };
      });
      const profitTrend = revVsCost.map(p => ({ label: p.label, value: money(p.revenue - p.cost) }));

      return ApiResponse.success(res, 'P&L report.', {
        summary: {
          totalSales: grossSales,
          returnAmount: returnsAmt,
          numberOfReturns: returns.length,
          amountCollected: money(sales.reduce((sum, sale) => sum + sale.paidAmount, 0)),
          expenses: operatingExpenses,
          numberOfSales: sales.length,
        },
        revenue:  { grossSales, discounts, returns: returnsAmt, netSales },
        costs:    { cogs, wastage, otherCosts: 0, totalCosts },
        expenses: { operating: operatingExpenses, totalExpenses: operatingExpenses, breakdown: expByCategory,
                    utilities: expByCategory['Electricity'] || 0, salaries: 0, rent: 0 },
        profit:   { grossProfit, netProfit, margin },
        charts: {
          revVsCost,
          profitTrend,
          expBreakdown: Object.entries(expByCategory).map(([label, value]) => ({ label, value })),
        },
      });
    } catch (err) { next(err); }
  }

  // ── F2 SALES REPORT ─────────────────────────────────────────────────────────
  static async f2Sales(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseRange(req);

      const allSales = await prisma.sale.findMany({
        where: { createdAt: { gte: new Date(from + 'T00:00:00'), lte: new Date(to + 'T23:59:59') } },
        include: { items: true, payments: true, customer: true },
        orderBy: { createdAt: 'desc' },
      });

      const f2Names = ['lassi', 'butter', 'ghee'];
      const isF2Item = (name: string) => f2Names.includes((name || '').trim().toLowerCase());

      const sales = allSales.filter(s => s.items.some(i => isF2Item(i.itemName)));

      let netSales = 0, cashSales = 0, onlineSales = 0, splitSales = 0;
      const catTotals: Record<string, number> = {};
      const byDate: Record<string, number> = {};

      for (const sale of sales) {
        netSales = money(netSales + sale.totalAmount);
        const key = toYMD(sale.createdAt);
        byDate[key] = money((byDate[key] || 0) + sale.totalAmount);

        if (sale.saleType === 'walk_in') {
          if (sale.payments[0]?.method === 'online') onlineSales = money(onlineSales + sale.totalAmount);
          else cashSales = money(cashSales + sale.totalAmount);
        } else if (sale.saleType === 'split') {
          splitSales = money(splitSales + (sale.payments[0]?.amount ?? 0));
        }

        for (const item of sale.items) {
          if (isF2Item(item.itemName)) {
            const raw = item.itemName.trim().toLowerCase();
            const label = raw.charAt(0).toUpperCase() + raw.slice(1);
            catTotals[label] = money((catTotals[label] || 0) + item.totalPrice);
          }
        }
      }

      const catTotal = money(Object.values(catTotals).reduce((s, v) => s + v, 0));
      const categoryBreakdown = Object.entries(catTotals).map(([label, amount]) => ({
        label, amount, value: catTotal > 0 ? Math.round((amount / catTotal) * 100) : 0,
      }));

      return ApiResponse.success(res, 'F2 sales report.', {
        sales: sales.map(s => ({
          id: s.id, createdAt: s.createdAt.toISOString(),
          saleType: s.saleType,
          customerId: s.customerId, customerName: s.customerName || s.customer?.name || null,
          customerPhone: s.customerPhone,
          totalAmount: s.totalAmount, paidAmount: s.paidAmount, remainingBalance: s.remainingBalance,
          status: s.status, updatedAt: s.updatedAt.toISOString(),
          items: s.items.map(i => ({ id: i.id, saleId: i.saleId, itemName: i.itemName, quantity: i.quantity, unitPrice: i.unitPrice, totalPrice: i.totalPrice, createdAt: i.createdAt.toISOString() })),
          payments: s.payments.map(p => ({ id: p.id, saleId: p.saleId, method: p.method, amount: p.amount, status: p.status, createdAt: p.createdAt.toISOString() })),
        })),
        analytics: {
          summary: { netSales, cashSales, onlineSales, splitSales, totalBills: sales.length },
          trend: fillDailyTrend(from, to, byDate),
          paymentMethods: [],
          categoryBreakdown,
        },
      });
    } catch (err) { next(err); }
  }

  // ── F2 ITEM SUMMARY ────────────────────────────────────────────────────────
  static async f2ItemSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to, start, end } = parseRange(req);
      const [dailyRows, products, rate, supplierCost] = await Promise.all([
        prisma.milkProductDailyStock.findMany({ where: { date: { gte: start, lte: end } } }),
        prisma.inventoryProduct.findMany({ where: { code: { in: ['LASSI', 'BUTTER', 'GHEE'] } }, select: { id: true, code: true } }),
        prisma.dailyRate.findFirst({ where: { date: { lte: end } }, orderBy: [{ date: 'desc' }, { id: 'desc' }] }),
        prisma.supplierCollection.aggregate({ where: { quantity: { gt: 0 }, rate: { gt: 0 }, date: { lte: to } }, _avg: { rate: true } }),
      ]);

      const totals = dailyRows.reduce((sum, row) => ({
        milkTotal: money(sum.milkTotal + row.milkTotal),
        lassiProduced: money(sum.lassiProduced + row.lassiProduced),
        lassiSold: money(sum.lassiSold + row.lassiSold),
        butterProduced: money(sum.butterProduced + row.butterProduced),
        butterSold: money(sum.butterSold + row.butterSold),
        butterConverted: money(sum.butterConverted + row.butterConverted),
        gheeProduced: money(sum.gheeProduced + row.gheeProduced),
        gheeSold: money(sum.gheeSold + row.gheeSold),
      }), {
        milkTotal: 0, lassiProduced: 0, lassiSold: 0, butterProduced: 0,
        butterSold: 0, butterConverted: 0, gheeProduced: 0, gheeSold: 0,
      });

      const closingByCode: Record<string, number> = {};
      await Promise.all(products.map(async (product) => {
        const result = await prisma.inventoryMovement.aggregate({
          where: { productId: product.id, date: { lte: end } },
          _sum: { quantity: true },
        });
        closingByCode[product.code] = money(Number(result._sum.quantity || 0));
      }));

      const milkCostPerKg = money(Number(supplierCost._avg.rate ?? 0) || Number(rate?.milkRate || 0) * 0.65);
      const lassiRatePerKg = Number(rate?.lassiRate || 0);
      const butterRatePerKg = Number(rate?.butterRate || 0);
      const milkAddedCost = money(totals.milkTotal * milkCostPerKg);
      const lassiRecovery = money(totals.lassiSold * lassiRatePerKg);
      const butterInventoryValue = money(Math.max(closingByCode.BUTTER || 0, 0) * butterRatePerKg);
      const butterTotalValue = money(butterInventoryValue + lassiRecovery);
      const butterRecoveryResult = money(butterTotalValue - milkAddedCost);

      return ApiResponse.success(res, 'F2 item summary.', {
        date: to,
        milkTotal: totals.milkTotal,
        milkRatePerKg: milkCostPerKg,
        milkCostPerKg,
        lassiRatePerKg,
        butterRatePerKg,
        milkAddedCost,
        milkRecoveredFromLassi: lassiRecovery,
        milkRecoveredFromButter: money(Math.min(totals.butterSold * butterRatePerKg, milkAddedCost)),
        milkLossCost: money(Math.max(milkAddedCost - lassiRecovery, 0)),
        butterInventoryValue,
        butterTotalValue,
        butterRecoveryResult,
        lassiProduced: totals.lassiProduced,
        lassiSold: totals.lassiSold,
        lassiRemaining: Math.max(closingByCode.LASSI || 0, 0),
        butterOpening: 0,
        butterProduced: totals.butterProduced,
        butterSold: totals.butterSold,
        butterConverted: totals.butterConverted,
        butterClosing: Math.max(closingByCode.BUTTER || 0, 0),
        gheeOpening: 0,
        gheeProduced: totals.gheeProduced,
        gheeSold: totals.gheeSold,
        gheeClosing: Math.max(closingByCode.GHEE || 0, 0),
      });
    } catch (err) { next(err); }
  }
}
