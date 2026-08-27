import { apiClient } from './apiClient';
import { DateFilterType } from '../types';

// Use local timezone date (not UTC) to avoid off-by-one at midnight in +5 timezones
function toYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateRange(filter: DateFilterType): { from: string; to: string } {
  const now = new Date();
  if (filter.label === 'Today') {
    const s = toYMD(now);
    return { from: s, to: s };
  }
  if (filter.label === 'Yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    const s = toYMD(y);
    return { from: s, to: s };
  }
  if (filter.label === 'This Week') {
    const start = new Date(now);
    start.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
    return { from: toYMD(start), to: toYMD(now) };
  }
  if (filter.label === 'This Month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: toYMD(start), to: toYMD(now) };
  }
  // Custom range
  const from = filter.startDate ? toYMD(filter.startDate) : toYMD(now);
  const to   = filter.endDate   ? toYMD(filter.endDate)   : toYMD(now);
  return { from, to };
}

export const dashboardService = {
  async getMetrics(filter: DateFilterType) {
    const { from, to } = dateRange(filter);
    const res = await apiClient.get('/dashboard/metrics', { from, to });
    return res.data;
  },

  async getRecentSales() {
    const res = await apiClient.get('/dashboard/recent-sales');
    return res.data ?? [];
  },

  async getKhataCustomers() {
    const res = await apiClient.get('/dashboard/khata-customers');
    return res.data ?? [];
  },

  async getRevenueTrend(filter: DateFilterType) {
    const { from, to } = dateRange(filter);
    const res = await apiClient.get('/dashboard/revenue-trend', { from, to });
    return res.data ?? [];
  },
};
