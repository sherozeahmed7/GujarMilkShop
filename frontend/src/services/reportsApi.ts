/**
 * Reports API — calls real /api/reports/* backend endpoints.
 * All functions match the exact data shapes expected by report pages.
 */
import { DateFilterType } from '../types';
import { apiClient } from './apiClient';
import { saleService } from './sale.service';

// Use local timezone — avoids off-by-one at midnight in UTC+5 (PKT)
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateParams(filter: DateFilterType): { from: string; to: string } {
  const now = new Date();
  if (filter.label === 'Today') {
    const s = toYMD(now); return { from: s, to: s };
  }
  if (filter.label === 'Yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const s = toYMD(y); return { from: s, to: s };
  }
  if (filter.label === 'This Week') {
    const start = new Date(now);
    start.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    return { from: toYMD(start), to: toYMD(now) };
  }
  if (filter.label === 'This Month') {
    return { from: toYMD(new Date(now.getFullYear(), now.getMonth(), 1)), to: toYMD(now) };
  }
  if (filter.label === 'All Time') {
    return { from: '2020-01-01', to: toYMD(now) };
  }
  const from = filter.startDate ? toYMD(filter.startDate) : toYMD(now);
  const to   = filter.endDate   ? toYMD(filter.endDate)   : toYMD(now);
  return { from, to };
}

// ── Sales Report (already uses real saleService — keep as-is) ────────────────
export const getSalesReport = async (filter: DateFilterType) => {
  const { from, to } = dateParams(filter);
  const result = await saleService.getSalesReport({ fromDate: from, toDate: to });
  const { sales, analytics } = result;

  const completed = sales.filter((s: any) => s.status !== 'voided');
  const totalSales  = analytics.summary.netSales;
  const discounts   = 0;
  const netSales    = analytics.summary.netSales;
  const cashSales   = analytics.summary.cashSales;
  const onlineSales = analytics.summary.onlineSales;
  const creditSales = analytics.summary.splitSales;
  const totalBills  = analytics.summary.totalBills;
  const refunds     = 0;

  const transactions = completed.map((s: any) => {
    const method = s.payments?.[0]?.method;
    const pm = s.saleType === 'walk_in'
      ? (method === 'online' ? 'Online' : 'Cash')
      : s.saleType === 'split' ? 'Credit'
      : 'Credit';
    return {
      id: `INV-${String(s.id).padStart(5, '0')}`,
      date: s.createdAt.split('T')[0],
      time: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      customer: s.customerName || (s.customer?.name) || 'Walk-in',
      customerId: String(s.customerId || ''),
      paymentMethod: pm,
      items: s.items?.length || 0,
      category: s.items?.[0]?.itemName || 'Milk',
      gross: s.totalAmount,
      discount: 0,
      net: s.totalAmount,
      costOfGoods: 0,
      cashier: 'System',
      shiftId: '',
      status: 'Completed',
      refund: 0,
    };
  });

  return {
    summary: { totalSales, discounts, netSales, refunds, cashSales, creditSales, onlineSales, totalBills,
               averageBillValue: totalBills > 0 ? Math.round(netSales / totalBills) : 0 },
    trendData:           analytics.trend.map((t: any) => ({ label: t.label, value: t.value })),
    paymentMethodData:   analytics.paymentMethods.map((p: any) => ({ label: p.name, value: p.value })),
    productCategoryData: analytics.categoryBreakdown.map((c: any) => ({ label: c.label, value: c.value })),
    transactions,
  };
};

// ── Expenses Report ───────────────────────────────────────────────────────────
export const getExpensesReport = async (filter: DateFilterType) => {
  const { from, to } = dateParams(filter);
  const res = await apiClient.get('/reports/expenses', { from, to });
  return res.data;
};

// ── Returns Report ────────────────────────────────────────────────────────────
export const getReturnsReport = async (filter: DateFilterType) => {
  const { from, to } = dateParams(filter);
  const res = await apiClient.get('/reports/returns', { from, to });
  return res.data;
};

// ── Shifts Report ─────────────────────────────────────────────────────────────
export const getShiftsReport = async (filter: DateFilterType) => {
  const { from, to } = dateParams(filter);
  const res = await apiClient.get('/reports/shifts', { from, to });
  return res.data;
};

// ── Cash Register Report ──────────────────────────────────────────────────────
export const getCashRegisterReport = async (filter: DateFilterType) => {
  const { from, to } = dateParams(filter);
  const res = await apiClient.get('/reports/cash-register', { from, to });
  return res.data;
};

// ── Customer Report ───────────────────────────────────────────────────────────
export const getCustomerReport = async (filter: DateFilterType) => {
  const { from, to } = dateParams(filter);
  const res = await apiClient.get('/reports/customers', { from, to });
  return res.data;
};

// ── Supplier Report ───────────────────────────────────────────────────────────
export const getSupplierReport = async (filter: DateFilterType) => {
  const { from, to } = dateParams(filter);
  const res = await apiClient.get('/reports/suppliers', { from, to });
  return res.data;
};

// ── Inventory Report ──────────────────────────────────────────────────────────
export const getInventoryReport = async () => {
  const res = await apiClient.get('/reports/inventory');
  return res.data;
};

// ── Profit & Loss Report ──────────────────────────────────────────────────────
export const getProfitAndLossReport = async (filter: DateFilterType) => {
  const { from, to } = dateParams(filter);
  const res = await apiClient.get('/reports/profit-loss', { from, to });
  return res.data;
};

// ── F2 Sales Report ───────────────────────────────────────────────────────────
export const getF2SalesReport = async (filter: DateFilterType) => {
  const { from, to } = dateParams(filter);
  const res = await apiClient.get('/reports/f2-sales', { from, to });
  return res.data;
};

export const getF2ItemSummary = async (filter: DateFilterType) => {
  const { from, to } = dateParams(filter);
  const res = await apiClient.get('/reports/f2-item-summary', { from, to });
  return res.data;
};

// ── Backup Report (no backend — stays as local data) ─────────────────────────
export const getBackupReport = async () => {
  const { initialMockBackups } = await import('../data/backupMockData');
  const successful = initialMockBackups.filter((b: any) => b.status !== 'Failed');
  const totalSize  = successful.reduce((s: number, b: any) => s + (b.sizeKb || 0) * 1024, 0);
  return {
    summary: {
      totalBackups:      initialMockBackups.length,
      latestBackup:      initialMockBackups[0]?.createdAt?.split('T')[0] || '—',
      successfulBackups: successful.length,
      failedBackups:     initialMockBackups.filter((b: any) => b.status === 'Failed').length,
      totalStorage:      `${(totalSize / (1024 * 1024)).toFixed(1)} MB`,
      backupFrequency:   'Manual',
    },
    backups: initialMockBackups,
  };
};

// ── Re-export legacy alias ────────────────────────────────────────────────────
export const reportsApi = {
  getSalesReport, getProfitAndLossReport, getSupplierReport, getCustomerReport,
  getInventoryReport, getReturnsReport, getCashRegisterReport, getShiftsReport,
  getExpensesReport, getBackupReport,
};
