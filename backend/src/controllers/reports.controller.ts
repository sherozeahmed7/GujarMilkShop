import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { averageInventoryCost } from '../utils/inventoryCost';
import { currentDrawerCash } from '../services/reportCash.service';
import { calculateF2Costs } from '../utils/f2Costing';

const money = (n: number) => Math.round(n * 100) / 100;

function toYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
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
  const to = (req.query.to as string) || today;
  return { from, to, ...rangeBounds(from, to) };
}
function fillDailyTrend(from: string, to: string, byDate: Record<string, number>) {
  const points: { label: string; value: number }[] = [];
  const cursor = new Date(from + 'T12:00:00');
  const endD = new Date(to + 'T12:00:00');
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
          todayAmount: money(fmt(allExp.filter(e => e.date === today))),
          thisWeekAmount: money(fmt(allExp.filter(e => e.date >= weekStart))),
          thisMonthAmount: money(fmt(allExp.filter(e => e.date >= monthStart))),
          cashExpenses: money(fmt(periodExp.filter(e => !e.description?.toLowerCase().includes('bank')))),
          bankExpenses: 0,
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
      const cashRefunds = money(returns.filter(r => r.paymentMethod === 'Cash').reduce((s, r) => s + r.refundAmount, 0));
      const byDate: Record<string, number> = {};
      const byCat: Record<string, number> = {};
      const byReason: Record<string, number> = {};

      for (const r of returns) {
        byDate[r.date] = money((byDate[r.date] || 0) + r.refundAmount);
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
        byCategory: Object.entries(byCat).map(([label, value]) => ({ label, value })),
        byReason: Object.entries(byReason).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
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

      // --- PERFORMANCE FIX: single batch query instead of N per-shift queries ---
      // Fetch all sales+payments that fall within the full range of all shifts at once
      const allSalesInRange = shifts.length > 0
        ? await prisma.sale.findMany({
            where: {
              createdAt: {
                gte: shifts[shifts.length - 1].openedAt, // oldest shift start
                lte: shifts[0].closedAt ?? new Date(),   // newest shift end
              },
            },
            include: { payments: true },
          })
        : [];

      // Map sales to their shift windows in-memory (no extra DB round trips)
      const shiftRows = shifts.map((s) => {
        const shiftEnd = s.closedAt ?? new Date();
        const sales = allSalesInRange.filter(
          (sale) => sale.createdAt >= s.openedAt && sale.createdAt <= shiftEnd
        );
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
      });

      const cashierMap: Record<string, { sales: number; hours: number; shifts: number }> = {};
      for (const s of shiftRows) {
        if (!cashierMap[s.openedBy]) cashierMap[s.openedBy] = { sales: 0, hours: 0, shifts: 0 };
        cashierMap[s.openedBy].sales += s.cashSales;
        cashierMap[s.openedBy].hours += s.durationHours;
        cashierMap[s.openedBy].shifts += 1;
      }

      return ApiResponse.success(res, 'Shifts report.', {
        summary: {
          totalShifts: shiftRows.length,
          openShifts: shiftRows.filter(s => s.status === 'Open').length,
          closedShifts: shiftRows.filter(s => s.status === 'Closed').length,
          totalHours: shiftRows.reduce((s, r) => s + r.durationHours, 0),
          openingCash: shiftRows.length ? shiftRows[shiftRows.length - 1].openingCash : 0,
          expectedCash: money(shiftRows.reduce((s, r) => s + r.expectedCash, 0)),
          countedCash: money(shiftRows.reduce((s, r) => s + r.countedCash, 0)),
          totalVariance: money(shiftRows.reduce((s, r) => s + Math.abs(r.variance), 0)),
        },
        shifts: shiftRows,
        salesByShift: shiftRows.slice(0, 10).map(s => ({ label: s.id, value: s.cashSales })),
        byCashier: Object.entries(cashierMap).map(([label, d]) => ({ label, value: d.sales })),
        varianceByShift: shiftRows.slice(0, 10).map(s => ({ label: s.id, value: Math.abs(s.variance) })),
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

      if (shifts.length === 0) {
        return ApiResponse.success(res, 'Cash register report.', { summary: {}, history: [], movementData: [] });
      }

      const shiftIds = shifts.map(s => s.id);
      const shiftDates = [...new Set(shifts.map(s => s.shiftDate))];
      const rangeStart = shifts[0].openedAt;
      const rangeEnd = shifts[shifts.length - 1].closedAt ?? new Date();

      // --- PERFORMANCE FIX: 5 bulk queries instead of 4*N per-shift queries ---
      const [allSales, allExpensePayments, allDateExpenses, allSupplierPayments, allReturns] = await Promise.all([
        prisma.sale.findMany({
          where: { createdAt: { gte: rangeStart, lte: rangeEnd } },
          include: { payments: true },
        }),
        prisma.expensePayment.findMany({ where: { shiftId: { in: shiftIds } } }),
        prisma.expense.findMany({ where: { date: { in: shiftDates } } }),
        prisma.supplierPayment.findMany({ where: { shiftId: { in: shiftIds }, method: 'cash' } }),
        prisma.return.findMany({ where: { date: { in: shiftDates }, paymentMethod: 'Cash' } }),
      ]);

      // Group lookup maps for O(1) per-shift access
      const expPayByShift = new Map<number, typeof allExpensePayments>();
      for (const ep of allExpensePayments) {
        const arr = expPayByShift.get(ep.shiftId!) || [];
        arr.push(ep); expPayByShift.set(ep.shiftId!, arr);
      }
      const dateExpByDate = new Map<string, typeof allDateExpenses>();
      for (const e of allDateExpenses) {
        const arr = dateExpByDate.get(e.date) || [];
        arr.push(e); dateExpByDate.set(e.date, arr);
      }
      const supPayByShift = new Map<number, typeof allSupplierPayments>();
      for (const sp of allSupplierPayments) {
        const arr = supPayByShift.get(sp.shiftId!) || [];
        arr.push(sp); supPayByShift.set(sp.shiftId!, arr);
      }
      const returnsByDate = new Map<string, typeof allReturns>();
      for (const r of allReturns) {
        const arr = returnsByDate.get(r.date) || [];
        arr.push(r); returnsByDate.set(r.date, arr);
      }

      // Build history rows entirely in-memory
      const history = shifts.map((s) => {
        const shiftEnd = s.closedAt ?? new Date();

        // 1. Cash sales during shift window
        const sales = allSales.filter(sale => sale.createdAt >= s.openedAt && sale.createdAt <= shiftEnd);
        let cashSales = 0;
        for (const sale of sales) {
          const cashPmts = (sale.payments || []).filter(p => p.method === 'cash');
          if (cashPmts.length > 0) {
            cashSales += cashPmts.reduce((sum, p) => sum + (p.amount || 0), 0);
          } else if (sale.saleType === 'walk_in') {
            cashSales += (sale.paidAmount || sale.totalAmount || 0);
          } else if (sale.saleType === 'split') {
            cashSales += (sale.paidAmount || 0);
          }
        }

        // 2. Expenses & outflows from pre-fetched maps
        const expensePayments = expPayByShift.get(s.id) || [];
        const dateExpenses = dateExpByDate.get(s.shiftDate) || [];
        const supplierCashPayments = supPayByShift.get(s.id) || [];
        const returnsList = returnsByDate.get(s.shiftDate) || [];

        const expensePaidTotal = expensePayments.length > 0
          ? expensePayments.reduce((sum, ep) => sum + ep.amount, 0)
          : dateExpenses.reduce((sum, e) => sum + e.netExpense, 0);
        const supplierCashOut = supplierCashPayments.reduce((sum, sp) => sum + sp.amount, 0);
        const refundsTotal = returnsList.reduce((sum, r) => sum + r.refundAmount, 0);

        const cashIn = money(cashSales);
        const cashOut = money(expensePaidTotal + supplierCashOut + refundsTotal);
        const calculatedExpected = money(s.openingCash + cashIn - cashOut);
        const expectedCash = s.status === 'Open' ? calculatedExpected : (s.expectedCash || calculatedExpected);
        const countedCash = s.countedCash ?? (s.status === 'Open' ? calculatedExpected : 0);
        const variance = s.difference ?? money(countedCash - expectedCash);

        return {
          id: `REG-${s.shiftDate}`,
          date: s.shiftDate,
          cashier: s.openedBy?.name || s.openedBy?.email || 'Admin',
          openingCash: money(s.openingCash),
          cashSales: money(cashSales),
          cashIn,
          cashOut,
          expenses: money(expensePaidTotal + supplierCashOut),
          refunds: money(refundsTotal),
          expectedCash: money(expectedCash),
          countedCash: money(countedCash),
          variance: money(variance),
          closingCash: money(countedCash),
          status: Math.abs(variance) < 1 ? 'Balanced' : 'Variance',
        };
      });

      const totals = {
        openingCash: history.length ? history[0].openingCash : 0,
        cashSales: money(history.reduce((s, r) => s + r.cashSales, 0)),
        cashIn: money(history.reduce((s, r) => s + r.cashIn, 0)),
        cashOut: money(history.reduce((s, r) => s + r.cashOut, 0)),
        expenses: money(history.reduce((s, r) => s + r.expenses, 0)),
        refunds: money(history.reduce((s, r) => s + r.refunds, 0)),
        expectedCash: money(history.reduce((s, r) => s + r.expectedCash, 0)),
        countedCash: money(history.reduce((s, r) => s + r.countedCash, 0)),
        variance: money(history.reduce((s, r) => s + r.variance, 0)),
        closingCash: history.length ? history[history.length - 1].closingCash : 0,
      };

      const movementData = [...history].slice(0, 14).map(r => ({
        label: dayLabel(r.date),
        cashIn: r.cashIn,
        cashOut: r.cashOut,
        expected: r.expectedCash,
        actual: r.countedCash,
      }));

      return ApiResponse.success(res, 'Cash register report.', { summary: totals, history, movementData });
    } catch (err) { next(err); }
  }

  // ── CUSTOMER REPORT ─────────────────────────────────────────────────────────
  static async customers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to } = parseRange(req);
      const fromDate = new Date(from + 'T00:00:00');
      const toDate = new Date(to + 'T23:59:59');

      // --- PERFORMANCE FIX: load customers lightweight, fetch sales separately ---
      // Loading ALL sales for ALL customers via include was scanning the entire Sale table.
      // Instead we run 2 bounded queries and join in-memory.
      const [customers, periodSalesRaw, allOutstandingSales] = await Promise.all([
        prisma.customer.findMany({ orderBy: { name: 'asc' } }),
        // Period sales with payments (only for the requested date window)
        prisma.sale.findMany({
          where: { customerId: { not: null }, createdAt: { gte: fromDate, lte: toDate } },
          select: { id: true, customerId: true, totalAmount: true, paidAmount: true, createdAt: true },
        }),
        // Outstanding balances: only unpaid sales, not time-bounded
        prisma.sale.findMany({
          where: { customerId: { not: null }, remainingBalance: { gt: 0 } },
          select: { customerId: true, remainingBalance: true },
        }),
      ]);

      // Build lookup maps indexed by customerId
      const periodSalesByCustomer = new Map<number, typeof periodSalesRaw>();
      for (const s of periodSalesRaw) {
        const arr = periodSalesByCustomer.get(s.customerId!) || [];
        arr.push(s); periodSalesByCustomer.set(s.customerId!, arr);
      }
      const outstandingByCustomer = new Map<number, number>();
      for (const s of allOutstandingSales) {
        outstandingByCustomer.set(s.customerId!, (outstandingByCustomer.get(s.customerId!) || 0) + s.remainingBalance);
      }

      const rows = customers.map(c => {
        const cSales = periodSalesByCustomer.get(c.id) || [];
        const totalSales = money(cSales.reduce((s, x) => s + x.totalAmount, 0));
        const paid = money(cSales.reduce((s, x) => s + x.paidAmount, 0));
        const outstanding = money(outstandingByCustomer.get(c.id) || 0);
        const lastSale = cSales.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        return {
          id: c.id, name: c.name, phone: c.phone || '',
          totalSales, paid, credit: totalSales, outstanding,
          lastPurchase: lastSale?.createdAt.toISOString() || c.updatedAt.toISOString(),
          isActive: c.status === 'active',
        };
      }).filter(c => c.totalSales > 0 || c.outstanding > 0);

      rows.sort((a, b) => b.totalSales - a.totalSales);

      const byDate: Record<string, number> = {};
      for (const s of periodSalesRaw) {
        const key = toYMD(s.createdAt);
        byDate[key] = money((byDate[key] || 0) + s.totalAmount);
      }

      return ApiResponse.success(res, 'Customer report.', {
        summary: {
          totalCustomers: customers.length,
          activeCustomers: customers.filter(c => c.status === 'active').length,
          totalCustomerSales: money(rows.reduce((s, c) => s + c.totalSales, 0)),
          totalCollected: money(rows.reduce((s, c) => s + c.paid, 0)),
          totalOutstanding: money(rows.reduce((s, c) => s + c.outstanding, 0)),
          creditSales: money(rows.reduce((s, c) => s + c.credit, 0)),
          customerReturns: 0,
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
        const paid = money(s.payments.reduce((sum, p) => sum + p.amount, 0));
        const outstanding = money(Math.max(0, totalPurchases - paid));
        const allDates = [...s.collections.map(c => c.date), ...s.payments.map(p => p.date)].sort().reverse();
        return {
          id: String(s.id), name: s.name, phone: s.phone || '',
          totalPurchases, paid,
          returns: 0,
          incentives: 0,
          outstanding,
          lastTransaction: allDates[0] ? new Date(allDates[0] + 'T12:00:00').toISOString() : s.updatedAt.toISOString(),
          status: outstanding <= 0 ? 'Cleared' : 'Pending',
        };
      });

      return ApiResponse.success(res, 'Supplier report.', {
        summary: {
          totalSuppliers: rows.length,
          totalPurchases: money(rows.reduce((s, r) => s + r.totalPurchases, 0)),
          totalPaid: money(rows.reduce((s, r) => s + r.paid, 0)),
          totalPayable: money(rows.reduce((s, r) => s + r.outstanding, 0)),
          totalReturns: 0,
          totalIncentives: 0,
          outstandingBalance: money(rows.reduce((s, r) => s + r.outstanding, 0)),
        },
        suppliers: rows,
        purchasesBySupplier: rows.map(r => ({ label: r.name.split(' ')[0], value: r.totalPurchases })),
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
        const stock = p.movements.reduce((s, m) => s + m.quantity, 0);
        const costRows = p.movements.filter(m => m.unitCost && m.unitCost > 0);
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
        const lastMove = p.movements.sort((a, b) => b.date.getTime() - a.date.getTime())[0];
        return {
          sku: p.code, name: p.name, category: p.category,
          supplier: 'N/A', stock: money(stock), costPrice, salePrice,
          inventoryValue: money(stock * costPrice),
          retailValue: money(stock * salePrice),
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
          totalProducts: rows.length,
          totalStock: money(rows.reduce((s, r) => s + r.stock, 0)),
          lowStockItems: rows.filter(r => r.stockStatus === 'Low Stock').length,
          outOfStockItems: rows.filter(r => r.stockStatus === 'Out of Stock').length,
          inventoryValue: money(rows.reduce((s, r) => s + r.inventoryValue, 0)),
          costValue: money(rows.reduce((s, r) => s + r.inventoryValue, 0)),
          estimatedRetailValue: money(rows.reduce((s, r) => s + r.retailValue, 0)),
        },
        products: rows,
        categories,
        suppliers: suppliersSet,
        stockByCategory: Object.entries(stockByCategory).map(([label, value]) => ({ label, value })),
        valueByCategory: Object.entries(valueByCategory).map(([label, value]) => ({ label, value })),
        lowStockProducts: rows.filter(r => r.stockStatus !== 'In Stock').map(r => {
          const prod = products.find(p => p.code === r.sku);
          return { label: r.name.split(' ')[0], value: Math.max(0, r.stock), max: prod?.lowStockThreshold || 0 };
        }),
        topSellingProducts: [],
      });
    } catch (err) { next(err); }
  }

  // ── PROFIT & LOSS REPORT ────────────────────────────────────────────────────
  static async profitLoss(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to, start, end } = parseRange(req);

      // F2 cost engine needs historical data to compute carrying costs correctly.
      // Cap the lookback to 2 years before the report start date so SQLite never
      // performs a full-table scan after a large data restore.
      const f2LookbackStart = new Date(start);
      f2LookbackStart.setFullYear(f2LookbackStart.getFullYear() - 2);
      const f2LookbackYMD = toYMD(f2LookbackStart);

      // Fetch all required domain records in parallel
      const [
        sales,
        returns,
        periodExpenses,
        periodPayments,
        periodSupplierPayments,
        allProducts,
        inventoryCostMovements,
        conversionsUpToTo,
        stockMovementsUpToTo,
        drawerCash,
        totalDrawerCash,
        f2Batches,
        f2HistoricalSales,
        f2HistoricalReturns,
        f2InventoryMovements,
        allTimeSupplierPaymentsResult,
      ] = await Promise.all([
        prisma.sale.findMany({
          where: {
            status: { not: 'voided' },
            createdAt: { gte: start, lte: end },
          },
          include: { items: true, payments: true },
        }),
        prisma.return.findMany({
          where: {
            date: { gte: from, lte: to },
            status: { not: 'Cancelled' },
          },
          include: { items: true },
        }),
        prisma.expense.findMany({
          where: { date: { gte: from, lte: to } },
          orderBy: [{ category: 'asc' }, { id: 'asc' }],
        }),
        prisma.payment.findMany({
          where: {
            createdAt: { gte: start, lte: end },
            status: { in: ['completed', 'partial'] },
          },
          include: { sale: true },
        }),
        prisma.supplierPayment.findMany({
          where: { date: { gte: from, lte: to } },
          select: { id: true, amount: true, method: true, date: true, supplierId: true },
        }),
        prisma.inventoryProduct.findMany({
          select: { id: true, code: true, name: true, category: true, unit: true },
        }),
        // Limit to 2-year lookback: WACC converges quickly; older data adds no precision
        prisma.inventoryMovement.findMany({
          where: { unitCost: { gt: 0 }, date: { gte: f2LookbackStart } },
          select: { productId: true, unitCost: true, date: true },
        }),
        prisma.butterGheeConversion.findMany({
          where: { date: { gte: f2LookbackStart, lte: end } },
          orderBy: { date: 'asc' },
        }),
        prisma.inventoryMovement.findMany({
          where: {
            date: { gte: f2LookbackStart, lte: end },
            movementType: { in: ['STOCK_IN', 'OPENING', 'PURCHASE'] },
            unitCost: { gt: 0 },
          },
          select: { productId: true, date: true, unitCost: true, quantity: true },
          orderBy: { date: 'asc' },
        }),
        currentDrawerCash(start, end),
        // Total cash-in-hand: use 2-year lookback instead of all-time scan
        currentDrawerCash(f2LookbackStart, end),
        prisma.milkProductDailyStock.findMany({ where: { date: { gte: f2LookbackStart, lte: end } }, orderBy: { date: 'asc' } }),
        prisma.sale.findMany({
          where: { status: { not: 'voided' }, createdAt: { gte: f2LookbackStart, lte: end }, items: { some: { itemName: { in: ['lassi', 'butter', 'ghee'] } } } },
          include: { items: true }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
        prisma.return.findMany({ where: { date: { gte: f2LookbackYMD, lte: to }, status: { not: 'Cancelled' } }, include: { items: true } }),
        prisma.inventoryMovement.findMany({
          where: { date: { gte: f2LookbackStart, lte: end }, product: { OR: [{ code: { in: ['LASSI', 'BUTTER', 'GHEE'] } }, { name: { in: ['Lassi', 'Butter', 'Ghee', 'lassi', 'butter', 'ghee'] } }] } },
          include: { product: { select: { code: true, name: true } } }, orderBy: [{ date: 'asc' }, { id: 'asc' }],
        }),
        prisma.supplierPayment.aggregate({ _sum: { amount: true } }),
      ]);


      // Use the current Inventory Cost column, including for historical report ranges.
      const milkProduct = allProducts.find(p => p.code?.toUpperCase() === 'MILK')
        ?? allProducts.find(p => p.name.trim().toLowerCase() === 'milk');
      const milkCostRows = inventoryCostMovements.filter(m => m.productId === milkProduct?.id);
      const milkInventoryUnitCost = averageInventoryCost(milkCostRows);
      const f2Costs = calculateF2Costs({
        milkUnitCost: milkInventoryUnitCost,
        milkCostsByDate: Object.fromEntries(f2Batches.map(batch => {
          const date = toYMD(batch.date);
          const cutoff = new Date(`${date}T23:59:59.999`);
          return [date, averageInventoryCost(milkCostRows.filter(movement => movement.date <= cutoff))];
        })),
        batches: f2Batches,
        conversions: conversionsUpToTo,
        sales: f2HistoricalSales,
        returns: f2HistoricalReturns,
        movements: f2InventoryMovements.map(movement => ({ ...movement, product: movement.product.code || movement.product.name })),
      });

      // Unit cost resolver for any product item
      const getUnitCostForProduct = (itemName: string, saleDate: Date): number => {
        const rawName = (itemName || '').trim().toLowerCase();
        const milkCost = milkInventoryUnitCost;

        if (rawName === 'milk') {
          return milkCost;
        }
        if (rawName === 'yogurt' || rawName === 'yog') {
          // Yogurt production uses 1 kg milk (at milk cost)
          return milkCost;
        }
        // F2 costs come from daily Lassi recovery and residual butter cost.
        if (['lassi', 'butter', 'ghee'].includes(rawName)) return 0;

        // Generic inventory product cost lookup from purchase/stock movements
        const matchedProd = allProducts.find(
          (p) => p.code?.toLowerCase() === rawName || p.name?.toLowerCase() === rawName
        );
        if (matchedProd) {
          const eligibleMoves = stockMovementsUpToTo.filter(
            (m) => m.productId === matchedProd.id && m.date <= saleDate
          );
          if (eligibleMoves.length > 0) {
            const sumCost = eligibleMoves.reduce((s, m) => s + (m.unitCost || 0), 0);
            return money(sumCost / eligibleMoves.length);
          }
        }
        return 0;
      };

      // ── 2. SALES, DISCOUNTS, AND PRODUCT REVENUE/COGS ──────────────────────
      let grossSales = 0;
      let posDiscounts = 0;
      let regularSalesNet = 0;

      type ProductCalculationLine = { kind: 'Sale' | 'Return'; quantity: number; revenue: number; unitCost: number; cost: number; basis?: string; missingQuantity?: number; provisional?: boolean };
      // Product aggregator map
      const productAgg = new Map<
        string,
        {
          product: string;
          displayName: string;
          quantitySold: number;
          revenue: number;
          cogs: number;
          grossProfit: number;
          margin: number;
          calculationLines: ProductCalculationLine[];
        }
      >();

      const ensureProductAgg = (key: string, displayName: string) => {
        if (!productAgg.has(key)) {
          productAgg.set(key, {
            product: key,
            displayName,
            quantitySold: 0,
            revenue: 0,
            cogs: 0,
            grossProfit: 0,
            margin: 0,
            calculationLines: [],
          });
        }
        return productAgg.get(key)!;
      };

      // Sales breakdown by type
      let cashSales = 0;
      let onlineSales = 0;
      let khataSales = 0;
      let splitSales = 0;
      let otherSales = 0;

      for (const sale of sales) {
        const saleFinalTotal = money(sale.totalAmount);
        const saleItemSubtotal = money(
          sale.items.reduce((sum, item) => sum + (item.totalPrice || money(item.quantity * item.unitPrice)), 0)
        );

        // Detect POS bill discount (when item subtotal > totalAmount)
        const billDiscount = Math.max(0, money(saleItemSubtotal - saleFinalTotal));
        const saleGross = billDiscount > 0 ? saleItemSubtotal : saleFinalTotal;

        grossSales = money(grossSales + saleGross);
        posDiscounts = money(posDiscounts + billDiscount);
        regularSalesNet = money(regularSalesNet + saleFinalTotal);

        // Sales method categorisation
        if (sale.saleType === 'walk_in') {
          const method = sale.payments?.[0]?.method;
          if (method === 'online') {
            onlineSales = money(onlineSales + saleFinalTotal);
          } else if (method === 'cash') {
            cashSales = money(cashSales + saleFinalTotal);
          } else {
            otherSales = money(otherSales + saleFinalTotal);
          }
        } else if (sale.saleType === 'split') {
          splitSales = money(splitSales + saleFinalTotal);
        } else if (sale.saleType === 'ledger_daily' || sale.saleType === 'ledger_monthly') {
          khataSales = money(khataSales + saleFinalTotal);
        } else {
          otherSales = money(otherSales + saleFinalTotal);
        }

        // Aggregate product line items
        for (const item of sale.items) {
          const rawKey = (item.itemName || 'other').trim().toLowerCase();
          const capName = rawKey.charAt(0).toUpperCase() + rawKey.slice(1);
          const pEntry = ensureProductAgg(rawKey, capName);

          const qty = Number(item.quantity) || 0;
          const lineTotal = item.totalPrice || money(qty * item.unitPrice);
          const f2Cost = f2Costs.saleCosts.get(item.id);
          const unitCost = f2Cost?.unitCost ?? getUnitCostForProduct(rawKey, sale.createdAt);
          const lineCost = f2Cost?.cost ?? money(qty * unitCost);

          pEntry.quantitySold = Math.round((pEntry.quantitySold + qty) * 1000) / 1000;
          pEntry.revenue = money(pEntry.revenue + lineTotal);
          pEntry.cogs = money(pEntry.cogs + lineCost);
          pEntry.calculationLines.push({ kind: 'Sale', quantity: qty, revenue: lineTotal, unitCost, cost: lineCost, basis: f2Cost?.basis, missingQuantity: f2Cost?.missingQuantity, provisional: f2Cost?.provisional });
        }
      }

      // ── 3. KHATA WRITE-OFF DISCOUNTS ─────────────────────────────────────────
      // Payments in selected period with method='discount' represent customer settlement write-offs
      const khataDiscountPayments = periodPayments.filter((p) => p.method === 'discount');
      const khataDiscounts = money(khataDiscountPayments.reduce((s, p) => s + p.amount, 0));
      const totalDiscounts = money(posDiscounts + khataDiscounts);
      const discountedSalesCount = sales.filter((s) => {
        const sub = money(s.items.reduce((sum, i) => sum + (i.totalPrice || money(i.quantity * i.unitPrice)), 0));
        return sub > money(s.totalAmount);
      }).length + (khataDiscounts > 0 ? khataDiscountPayments.length : 0);

      // ── 4. RETURNS & COGS REVERSALS ──────────────────────────────────────────
      let totalReturnAmount = 0;
      let totalReturnCount = returns.length;
      let totalCogsReversed = 0;

      const returnsBreakdown: Array<{
        id: string;
        billNumber: string;
        date: string;
        customer: string;
        refundAmount: number;
        paymentMethod: string;
        cogsReversed: number;
        items: Array<{ name: string; returnQty: number; unitPrice: number; refundAmount: number; cogsReversed: number }>;
      }> = [];

      for (const ret of returns) {
        const retAmount = money(ret.refundAmount);
        totalReturnAmount = money(totalReturnAmount + retAmount);

        let retCogsSum = 0;
        const shapedItems: Array<{ name: string; returnQty: number; unitPrice: number; refundAmount: number; cogsReversed: number }> = [];

        for (const item of ret.items) {
          const rawName = (item.name || '').trim().toLowerCase();
          const returnQty = Number(item.returnQty) || 0;
          const retItemRefund = money(Number(item.refundAmount) || 0);

          let retDate = new Date(ret.date + 'T12:00:00');
          if (isNaN(retDate.getTime())) {
            retDate = ret.createdAt || new Date();
          }
          const f2ReturnCost = f2Costs.returnCosts.get(item.id);
          const unitCost = f2ReturnCost?.unitCost ?? getUnitCostForProduct(rawName, retDate);
          const itemCogsReversed = f2ReturnCost?.cost ?? money(returnQty * unitCost);

          retCogsSum = money(retCogsSum + itemCogsReversed);
          shapedItems.push({
            name: item.name,
            returnQty,
            unitPrice: Number(item.unitPrice) || 0,
            refundAmount: retItemRefund,
            cogsReversed: itemCogsReversed,
          });

          // Returns of earlier sales must still reverse cost in this period.
          {
            const p = ensureProductAgg(rawName, rawName.charAt(0).toUpperCase() + rawName.slice(1));
            p.quantitySold = Math.round((p.quantitySold - returnQty) * 1000) / 1000;
            p.revenue = money(p.revenue - retItemRefund);
            p.cogs = money(p.cogs - itemCogsReversed);
            p.calculationLines.push({ kind: 'Return', quantity: returnQty, revenue: retItemRefund, unitCost, cost: itemCogsReversed, basis: f2ReturnCost?.basis, missingQuantity: f2ReturnCost?.missingQuantity, provisional: f2ReturnCost?.provisional });
          }
        }

        totalCogsReversed = money(totalCogsReversed + retCogsSum);
        returnsBreakdown.push({
          id: `RET-${String(ret.id).padStart(4, '0')}`,
          billNumber: ret.billNumber,
          date: ret.date,
          customer: ret.customer,
          refundAmount: retAmount,
          paymentMethod: ret.paymentMethod || 'Cash',
          cogsReversed: retCogsSum,
          items: shapedItems,
        });
      }

      // Final Net Sales = Gross Sales - Discounts - Returns
      const netSales = money(grossSales - totalDiscounts - totalReturnAmount);

      // Final COGS and Product Profitability
      let totalCogs = 0;
      const productProfitabilityList: Array<{
        product: string;
        displayName: string;
        quantitySold: number;
        revenue: number;
        cogs: number;
        grossProfit: number;
        margin: number;
      }> = [];

      for (const [, p] of productAgg) {
        p.grossProfit = money(p.revenue - p.cogs);
        p.margin = p.revenue > 0 ? parseFloat(((p.grossProfit / p.revenue) * 100).toFixed(2)) : 0;
        totalCogs = money(totalCogs + p.cogs);
        productProfitabilityList.push(p);
      }

      // Sort products by revenue descending
      productProfitabilityList.sort((a, b) => b.revenue - a.revenue);

      // Gross Profit
      const grossProfit = money(netSales - totalCogs);
      const grossMargin = netSales > 0 ? parseFloat(((grossProfit / netSales) * 100).toFixed(2)) : 0;

      // ── 5. OPERATING EXPENSES WITH SUBCATEGORIES ─────────────────────────────
      let totalExpenses = 0;
      const expenseCategoryMap = new Map<string, { total: number; subcategories: Record<string, number> }>();

      for (const exp of periodExpenses) {
        const cat = (exp.category || 'Other').trim() || 'Other';
        const sub = (exp.description || exp.category || 'General').trim() || 'General';
        const amt = money(exp.amount || exp.netExpense || 0);

        totalExpenses = money(totalExpenses + amt);

        if (!expenseCategoryMap.has(cat)) {
          expenseCategoryMap.set(cat, { total: 0, subcategories: {} });
        }
        const catEntry = expenseCategoryMap.get(cat)!;
        catEntry.total = money(catEntry.total + amt);
        catEntry.subcategories[sub] = money((catEntry.subcategories[sub] || 0) + amt);
      }

      const expenseBreakdown: Array<{
        category: string;
        total: number;
        subcategories: Array<{ subcategory: string; amount: number }>;
      }> = [];

      for (const [catName, catData] of expenseCategoryMap) {
        expenseBreakdown.push({
          category: catName,
          total: catData.total,
          subcategories: Object.entries(catData.subcategories).map(([subName, subAmt]) => ({
            subcategory: subName,
            amount: subAmt,
          })),
        });
      }
      expenseBreakdown.sort((a, b) => b.total - a.total);

      // ── 6. NET PROFIT & MARGIN ──────────────────────────────────────────────
      const netProfit = money(grossProfit - totalExpenses);
      const netProfitMargin = netSales > 0 ? parseFloat(((netProfit / netSales) * 100).toFixed(2)) : 0;

      // ── 7. AMOUNT COLLECTED BREAKDOWN & SUPPLIER PAYMENTS ─────────────────────
      const totalSupplierPaid = money(periodSupplierPayments.reduce((sum, p) => sum + (p.amount || 0), 0));
      const supplierCashPaid = money(periodSupplierPayments.filter(p => (p.method || 'cash').toLowerCase() === 'cash').reduce((sum, p) => sum + (p.amount || 0), 0));
      const supplierOnlinePaid = money(periodSupplierPayments.filter(p => (p.method || '').toLowerCase() === 'online').reduce((sum, p) => sum + (p.amount || 0), 0));
      const allTimeSupplierPaid = money(allTimeSupplierPaymentsResult._sum.amount || 0);

      // Cash/Online received during the period across ALL payment transactions (walk-in, split collections, khata settlement)
      let cashCollected = 0;
      let onlineCollected = 0;
      let khataReceived = 0;
      let otherCollected = 0;

      for (const pmt of periodPayments) {
        if (pmt.method === 'discount') continue; // Write-offs are discounts, not cash inflows
        const amt = money(pmt.amount);
        const pMethod = (pmt.method || 'cash').toLowerCase();

        // Categorise based on sale type and payment record
        const saleType = pmt.sale?.saleType;
        if (saleType === 'ledger_daily' || saleType === 'ledger_monthly') {
          khataReceived = money(khataReceived + amt);
        }

        if (pMethod === 'cash') {
          cashCollected = money(cashCollected + amt);
        } else if (pMethod === 'online') {
          onlineCollected = money(onlineCollected + amt);
        } else {
          otherCollected = money(otherCollected + amt);
        }
      }

      const totalAmountCollected = money(cashCollected + onlineCollected + otherCollected);
      // Current unpaid balance on bills created in the selected period.
      const borrowedAmount = money(sales.reduce((sum, sale) => sum + Math.max(0, sale.remainingBalance), 0));

      // ── 8. DAILY CHARTS & TRENDS ─────────────────────────────────────────────
      const byDateRevenue: Record<string, number> = {};
      const byDateCogs: Record<string, number> = {};

      for (const sale of sales) {
        const dKey = toYMD(sale.createdAt);
        byDateRevenue[dKey] = money((byDateRevenue[dKey] || 0) + sale.totalAmount);

        let saleCogs = 0;
        for (const item of sale.items) {
          const uCost = getUnitCostForProduct(item.itemName, sale.createdAt);
          saleCogs = money(saleCogs + (f2Costs.saleCosts.get(item.id)?.cost ?? money((item.quantity || 0) * uCost)));
        }
        byDateCogs[dKey] = money((byDateCogs[dKey] || 0) + saleCogs);
      }

      // Subtract returns from daily trend
      for (const ret of returns) {
        const dKey = ret.date;
        byDateRevenue[dKey] = money((byDateRevenue[dKey] || 0) - ret.refundAmount);
        const reversal = returnsBreakdown.find(r => r.id === `RET-${String(ret.id).padStart(4, '0')}`)?.cogsReversed || 0;
        byDateCogs[dKey] = money((byDateCogs[dKey] || 0) - reversal);
      }

      const dailyTrend = fillDailyTrend(from, to, byDateRevenue);
      const revVsCost = dailyTrend.map((p) => {
        const dateKey = Object.keys(byDateRevenue).find((k) => dayLabel(k) === p.label) || from;
        const cost = byDateCogs[dateKey] || 0;
        return {
          label: p.label,
          revenue: Math.max(0, p.value),
          cost,
        };
      });

      const profitTrend = revVsCost.map((p) => ({
        label: p.label,
        value: money(p.revenue - p.cost),
      }));

      // ── 9. FINAL RECONCILED PAYLOAD ──────────────────────────────────────────
      return ApiResponse.success(res, 'P&L report fetched successfully.', {
        dateRange: { from, to },
        summary: {
          grossSales,
          discounts: totalDiscounts,
          returns: totalReturnAmount,
          netSales,
          cogs: totalCogs,
          grossProfit,
          grossMargin,
          totalExpenses,
          totalSupplierPaid,
          supplierCashPaid,
          supplierOnlinePaid,
          supplierPaymentsCount: periodSupplierPayments.length,
          allTimeSupplierPaid,
          netProfit,
          netProfitMargin,
          amountCollected: totalAmountCollected,
          borrowedAmount,
          cashInHand: drawerCash.amount,
          cashInHandBasis: drawerCash.basis,
          cashInHandAsOf: drawerCash.asOf,
          drawerCashBreakdown: drawerCash.breakdown,
          totalCashInHand: totalDrawerCash.amount,
          totalCashInHandBasis: totalDrawerCash.basis,
          milkInventoryUnitCost,
          milkCostAvailable: milkCostRows.length > 0,
          f2CostComplete: f2Costs.warnings.length === 0,
          f2DayEndPending: f2Costs.allocations.some(batch => batch.date >= from && batch.date <= to && batch.provisional),
          numberOfSales: sales.length,
          numberOfReturns: totalReturnCount,
        },
        salesBreakdown: {
          cashSales,
          onlineSales,
          khataSales,
          splitSales,
          otherSales,
          netSales,
        },
        collectionsBreakdown: {
          cashCollected,
          onlineCollected,
          khataReceived,
          otherCollected,
          totalAmountCollected,
        },
        productProfitability: productProfitabilityList,
        f2CostAllocation: {
          method: 'Daily Lassi revenue recovery; unrecovered milk cost carried by butter',
          batches: f2Costs.allocations.filter(batch => batch.date >= from && batch.date <= to),
          conversions: f2Costs.conversions.filter(conversion => conversion.date >= from && conversion.date <= to),
          warnings: f2Costs.warnings,
        },
        returnsSummary: {
          totalReturnAmount,
          totalReturnCount,
          totalCogsReversed,
          list: returnsBreakdown,
        },
        discountsSummary: {
          totalDiscounts,
          posDiscounts,
          khataDiscounts,
          discountedSalesCount,
        },
        expensesSummary: {
          totalExpenses,
          categories: expenseBreakdown,
        },
        reconciliation: {
          grossSalesMinusDiscountsAndReturns: money(grossSales - totalDiscounts - totalReturnAmount),
          netSalesMatches: money(grossSales - totalDiscounts - totalReturnAmount) === netSales,
          netSalesMinusCogs: money(netSales - totalCogs),
          grossProfitMatches: money(netSales - totalCogs) === grossProfit,
          grossProfitMinusExpenses: money(grossProfit - totalExpenses),
          netProfitMatches: money(grossProfit - totalExpenses) === netProfit,
        },
        charts: {
          revVsCost,
          profitTrend,
          expBreakdown: expenseBreakdown.map((e) => ({ label: e.category, value: e.total })),
        },
      });
    } catch (err) {
      next(err);
    }
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
