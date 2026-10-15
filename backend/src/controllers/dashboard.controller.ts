import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const money = (n: number) => Math.round(n * 100) / 100;

function dayBounds(dateStr: string): { start: Date; end: Date } {
  const [y, m, d] = dateStr.split('-').map(Number);
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0),
    end:   new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

function rangeBounds(from: string, to: string): { start: Date; end: Date } {
  const s = dayBounds(from).start;
  const e = dayBounds(to).end;
  return { start: s, end: e };
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const metricsCache = new Map<string, CacheEntry<any>>();
const revenueTrendCache = new Map<string, CacheEntry<any>>();
let recentSalesCache: CacheEntry<any> | null = null;
let khataCustomersCache: CacheEntry<any> | null = null;

function getCached<T>(key: string, map: Map<string, CacheEntry<T>>): T | null {
  const entry = map.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data;
  if (entry) map.delete(key);
  return null;
}

function setCached<T>(key: string, data: T, ttlMs: number, map: Map<string, CacheEntry<T>>): void {
  map.set(key, { data, expiresAt: Date.now() + ttlMs });
}

export class DashboardController {
  /**
   * Invalidate all in-memory dashboard caches when a sale, payment, or expense changes.
   */
  static clearCache() {
    metricsCache.clear();
    revenueTrendCache.clear();
    recentSalesCache = null;
    khataCustomersCache = null;
  }

  /**
   * GET /api/dashboard/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Returns all KPI metrics needed by the dashboard stat cards.
   */
  static async getMetrics(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to } = req.query as { from?: string; to?: string };

      const today = new Date().toISOString().split('T')[0];
      const fromDate = from || today;
      const toDate   = to   || today;

      const cacheKey = `${fromDate}_${toDate}`;
      const cached = getCached(cacheKey, metricsCache);
      if (cached) {
        return ApiResponse.success(res, 'Dashboard metrics fetched (cached).', cached);
      }

      const { start, end } = rangeBounds(fromDate, toDate);

      // ── Sales in range ──────────────────────────────────────────────────
      const sales = await prisma.sale.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: { payments: true, items: true },
      });

      let grossSales   = 0;
      let cashSales    = 0;
      let onlineSales  = 0;
      let khataSales   = 0;
      const billsCount = sales.length;

      for (const sale of sales) {
        grossSales = money(grossSales + sale.totalAmount);
        if (sale.saleType === 'walk_in') {
          const method = sale.payments[0]?.method;
          if (method === 'online') onlineSales = money(onlineSales + sale.totalAmount);
          else cashSales = money(cashSales + sale.totalAmount);
        } else if (sale.saleType === 'split') {
          cashSales = money(cashSales + (sale.payments[0]?.amount ?? 0));
        } else {
          khataSales = money(khataSales + sale.totalAmount);
        }
      }

      const averageBill = billsCount > 0 ? money(grossSales / billsCount) : 0;

      // ── Returns in range ────────────────────────────────────────────────
      const returns = await prisma.return.findMany({
        where: { date: { gte: fromDate, lte: toDate } },
        select: { refundAmount: true },
      });
      const totalRefunds = money(returns.reduce((s, r) => s + r.refundAmount, 0));

      const netSales = money(grossSales - totalRefunds);

      // ── Expenses in range ───────────────────────────────────────────────
      const expenses = await prisma.expense.findMany({
        where: { date: { gte: fromDate, lte: toDate } },
        select: { netExpense: true },
      });
      const totalExpenses = money(expenses.reduce((s, e) => s + e.netExpense, 0));

      // ── Khata dues (cumulative — all time outstanding) ──────────────────
      const khataSalesAll = await prisma.sale.findMany({
        where: {
          saleType: { in: ['ledger_daily', 'ledger_monthly'] },
          remainingBalance: { gt: 0 },
        },
        select: { remainingBalance: true, customerId: true },
      });

      const khataDues = money(khataSalesAll.reduce((s, x) => s + x.remainingBalance, 0));
      const khataCustomerIds = new Set(khataSalesAll.map(x => x.customerId).filter(Boolean));
      const khataCustomerCount = khataCustomerIds.size;

      // ── Expected cash = opening cash + cash sales (from today's open shift) ─
      const openShift = await prisma.shift.findFirst({ where: { status: 'Open' } });
      const expectedCash = openShift ? money(openShift.expectedCash) : cashSales;

      const result = {
        grossSales,
        netSales,
        refunds: totalRefunds,
        totalExpenses,
        totalBills: billsCount,
        billsServed: billsCount,
        averageBill,
        cashSales,
        onlineSales,
        khataSales,
        expectedCash,
        cashCollected: cashSales,
        khataDues,
        khataCustomerCount,
      };

      setCached(cacheKey, result, 30_000, metricsCache);
      return ApiResponse.success(res, 'Dashboard metrics fetched.', result);
    } catch (e) { next(e); }
  }

  /**
   * GET /api/dashboard/recent-sales
   * Returns the 8 most recent sales with payment method.
   */
  static async getRecentSales(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (recentSalesCache && Date.now() < recentSalesCache.expiresAt) {
        return ApiResponse.success(res, 'Recent sales fetched (cached).', recentSalesCache.data);
      }

      const sales = await prisma.sale.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        include: { payments: true, customer: true },
      });

      const rows = sales.map(sale => {
        let payment: 'CASH' | 'ONLINE' | 'KHATA' = 'CASH';
        if (sale.saleType === 'ledger_daily' || sale.saleType === 'ledger_monthly') {
          payment = 'KHATA';
        } else if (sale.payments[0]?.method === 'online') {
          payment = 'ONLINE';
        }

        const createdAt = new Date(sale.createdAt);
        const h = createdAt.getHours();
        const m = String(createdAt.getMinutes()).padStart(2, '0');
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hr = h % 12 === 0 ? 12 : h % 12;
        const timeLabel = `${hr}:${m} ${ampm}`;

        const type = sale.saleType === 'walk_in' ? 'Walk-in'
          : sale.saleType === 'split' ? 'Split'
          : 'Khata';

        return {
          id: sale.id,
          type,
          timeLabel,
          amount: sale.totalAmount,
          payment,
          customerName: sale.customer?.name || sale.customerName || null,
        };
      });

      recentSalesCache = { data: rows, expiresAt: Date.now() + 15_000 };
      return ApiResponse.success(res, 'Recent sales fetched.', rows);
    } catch (e) { next(e); }
  }

  /**
   * GET /api/dashboard/khata-customers
   * Returns top outstanding khata customers sorted by balance desc.
   */
  static async getKhataCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (khataCustomersCache && Date.now() < khataCustomersCache.expiresAt) {
        return ApiResponse.success(res, 'Khata customers fetched (cached).', khataCustomersCache.data);
      }

      const customers = await prisma.customer.findMany({
        where: { status: 'active' },
        include: {
          sales: {
            where: { remainingBalance: { gt: 0 } },
            select: { remainingBalance: true, updatedAt: true },
          },
        },
      });

      const rows = customers
        .map(c => {
          const outstanding = money(c.sales.reduce((s, x) => s + x.remainingBalance, 0));
          const lastSale = c.sales.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0];
          return {
            id: c.id,
            name: c.name,
            phone: c.phone || '',
            amount: outstanding,
            type: c.customerType === 'monthly_ledger' ? 'Wholesale' : 'Retail',
            lastSaleDate: lastSale?.updatedAt?.toISOString() ?? null,
          };
        })
        .filter(c => c.amount > 0)
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8);

      khataCustomersCache = { data: rows, expiresAt: Date.now() + 15_000 };
      return ApiResponse.success(res, 'Khata customers fetched.', rows);
    } catch (e) { next(e); }
  }

  /**
   * GET /api/dashboard/revenue-trend?from=YYYY-MM-DD&to=YYYY-MM-DD
   * Returns daily revenue totals for the chart.
   */
  static async getRevenueTrend(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const today = new Date().toISOString().split('T')[0];
      const fromDate = from || today;
      const toDate   = to   || today;

      const cacheKey = `${fromDate}_${toDate}`;
      const cached = getCached(cacheKey, revenueTrendCache);
      if (cached) {
        return ApiResponse.success(res, 'Revenue trend fetched (cached).', cached);
      }

      const { start, end } = rangeBounds(fromDate, toDate);

      const sales = await prisma.sale.findMany({
        where: { createdAt: { gte: start, lte: end } },
        select: { totalAmount: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      // Group by date
      const byDate: Record<string, number> = {};
      for (const sale of sales) {
        const dateKey = new Date(sale.createdAt).toISOString().split('T')[0];
        byDate[dateKey] = money((byDate[dateKey] || 0) + sale.totalAmount);
      }

      // Fill all dates in range even if no sales
      const points: { label: string; value: number; date: string }[] = [];
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      while (cursor <= end) {
        const dateKey = cursor.toISOString().split('T')[0];
        const label = cursor.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
        points.push({ label, value: byDate[dateKey] || 0, date: dateKey });
        cursor.setDate(cursor.getDate() + 1);
      }

      setCached(cacheKey, points, 30_000, revenueTrendCache);
      return ApiResponse.success(res, 'Revenue trend fetched.', points);
    } catch (e) { next(e); }
  }
}
