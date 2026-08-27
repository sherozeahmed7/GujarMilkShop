/**
 * useDashboardData — real backend version
 * Fetches all dashboard data from /api/dashboard/* endpoints.
 */

import { useState, useEffect, useRef } from 'react';
import { DateFilterType } from '../types';
import { dashboardService } from '../services/dashboardService';

// ─── Shared types ────────────────────────────────────────────────────────────

export interface DashboardMetrics {
  grossSales: number;
  refunds: number;
  netSales: number;
  totalExpenses: number;
  totalBills: number;
  returns: number;
  creditAdded: number;
  pendingCredit: number;
  totalSaleKg: number;
  averageBill: number;
  expectedCash: number;
  cashCollected: number;
  onlineSales: number;
  khataDues: number;
  khataCustomerCount: number;
  billsServed: number;
}

export interface RecentSaleRow {
  id: number;
  type: string;
  timeLabel: string;
  amount: number;
  payment: 'CASH' | 'ONLINE' | 'KHATA';
}

export interface KhataCustomer {
  id: number;
  name: string;
  phone: string;
  amount: number;
  status: 'Overdue' | 'Due Soon' | 'On Track';
  type: 'Wholesale' | 'Retail' | 'Individual';
}

export interface RevenueDataPoint {
  label: string;
  value: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  recentSales: RecentSaleRow[];
  khataCustomers: KhataCustomer[];
  revenueChart: RevenueDataPoint[];
  chartInterval: 'hourly' | 'daily';
  chartTitleSuffix: string;
  chartSubtitle: string;
  periodLabel: string;
  periodSummary: string;
  isLoading: boolean;
  error: string | null;
}

const EMPTY_METRICS: DashboardMetrics = {
  grossSales: 0, refunds: 0, netSales: 0, totalExpenses: 0,
  totalBills: 0, returns: 0, creditAdded: 0, pendingCredit: 0,
  totalSaleKg: 0, averageBill: 0, expectedCash: 0, cashCollected: 0,
  onlineSales: 0, khataDues: 0, khataCustomerCount: 0, billsServed: 0,
};

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function getPeriodMeta(filter: DateFilterType): { periodLabel: string; periodSummary: string; chartTitleSuffix: string; chartSubtitle: string; chartInterval: 'hourly' | 'daily' } {
  const now = new Date();
  const { label } = filter;

  if (label === 'Today') return {
    periodLabel: 'today', periodSummary: fmtDateLong(now),
    chartTitleSuffix: 'Today', chartSubtitle: 'Daily revenue breakdown',
    chartInterval: 'daily',
  };
  if (label === 'Yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return {
      periodLabel: 'yesterday', periodSummary: fmtDateLong(y),
      chartTitleSuffix: 'Yesterday', chartSubtitle: 'Daily revenue breakdown',
      chartInterval: 'daily',
    };
  }
  if (label === 'This Week') return {
    periodLabel: 'this week', periodSummary: 'Current week',
    chartTitleSuffix: 'This Week', chartSubtitle: 'Daily revenue — current week',
    chartInterval: 'daily',
  };
  if (label === 'This Month') return {
    periodLabel: 'this month', periodSummary: now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    chartTitleSuffix: 'This Month', chartSubtitle: 'Daily revenue — current month',
    chartInterval: 'daily',
  };

  const start = filter.startDate ?? now;
  const end   = filter.endDate   ?? now;
  return {
    periodLabel: 'selected range',
    periodSummary: `${fmtDate(start)} – ${fmtDate(end)}`,
    chartTitleSuffix: `${fmtDate(start)} – ${fmtDate(end)}`,
    chartSubtitle: 'Daily revenue',
    chartInterval: 'daily',
  };
}

// ─── Main hook ───────────────────────────────────────────────────────────────

export function useDashboardData(dateFilter: DateFilterType): DashboardData {
  const [metrics, setMetrics]           = useState<DashboardMetrics>(EMPTY_METRICS);
  const [recentSales, setRecentSales]   = useState<RecentSaleRow[]>([]);
  const [khataCustomers, setKhata]      = useState<KhataCustomer[]>([]);
  const [revenueChart, setRevenue]      = useState<RevenueDataPoint[]>([]);
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // Stable filter key to avoid unnecessary re-fetches
  const filterKey = `${dateFilter.label}|${dateFilter.startDate?.toISOString() ?? ''}|${dateFilter.endDate?.toISOString() ?? ''}`;
  const prevKey = useRef('');

  useEffect(() => {
    if (prevKey.current === filterKey) return;
    prevKey.current = filterKey;

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      dashboardService.getMetrics(dateFilter),
      dashboardService.getRecentSales(),
      dashboardService.getKhataCustomers(),
      dashboardService.getRevenueTrend(dateFilter),
    ])
      .then(([m, rs, kc, rt]) => {
        if (cancelled) return;
        setMetrics({
          grossSales:         m.grossSales         ?? 0,
          refunds:            m.refunds             ?? 0,
          netSales:           m.netSales            ?? 0,
          totalExpenses:      m.totalExpenses       ?? 0,
          totalBills:         m.totalBills          ?? 0,
          returns:            m.refunds             ?? 0,
          creditAdded:        m.khataSales          ?? 0,
          pendingCredit:      m.khataDues           ?? 0,
          totalSaleKg:        0,
          averageBill:        m.averageBill         ?? 0,
          expectedCash:       m.expectedCash        ?? 0,
          cashCollected:      m.cashSales           ?? 0,
          onlineSales:        m.onlineSales         ?? 0,
          khataDues:          m.khataDues           ?? 0,
          khataCustomerCount: m.khataCustomerCount  ?? 0,
          billsServed:        m.billsServed         ?? 0,
        });
        setRecentSales(rs);
        setKhata(kc.map((c: any) => ({
          ...c,
          status: 'On Track' as const,  // backend doesn't compute status — keep neutral
        })));
        setRevenue(rt.map((p: any) => ({ label: p.label, value: p.value })));
        setIsLoading(false);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setError(err?.message || 'Failed to load dashboard data');
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [filterKey]);

  const meta = getPeriodMeta(dateFilter);

  return {
    metrics,
    recentSales,
    khataCustomers,
    revenueChart,
    isLoading,
    error,
    ...meta,
  };
}
