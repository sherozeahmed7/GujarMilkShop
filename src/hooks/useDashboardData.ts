/**
 * useDashboardData
 *
 * Single source of truth for all dashboard metrics.
 * Every value is derived from the shared DateFilterType.
 *
 * HOW TO REPLACE WITH REAL DATA:
 *   Each helper function (computeMetrics, computeRecentSales, etc.) maps
 *   1-to-1 with a future SQLite query. Replace the function body; keep the
 *   return type identical and the rest of the dashboard needs zero changes.
 */

import { useMemo } from 'react';
import { DateFilterType } from '../types';

// ─── Shared types ───────────────────────────────────────────────────────────

export interface DashboardMetrics {
  grossSales: number;
  refunds: number;
  netSales: number;
  totalExpenses: number;
  totalBills: number;
  returns: number;
  creditAdded: number;       // credit given during the period
  pendingCredit: number;     // still unpaid credit from the period
  totalSaleKg: number;
  averageBill: number;
  expectedCash: number;
  cashCollected: number;
  onlineSales: number;
  khataDues: number;         // cumulative outstanding (not period-filtered by design)
  khataCustomerCount: number;
  /** Bills served in period — used by PaceCard */
  billsServed: number;
}

export interface RecentSaleRow {
  id: number;
  type: string;
  /** e.g. "11:40" for today/yesterday, "Mon 11:40" for weekly, "12 Aug" for monthly */
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
  /** The human-readable period description for card subtitles */
  periodLabel: string;
  /** A short date-range summary, e.g. "Sat 16 Aug" or "01–16 Aug" */
  periodSummary: string;
}

// ─── Deterministic pseudo-random (avoids re-renders changing values) ─────────

function seededRnd(seed: number, min: number, max: number): number {
  const x = Math.sin(seed + 1) * 10000;
  const t = x - Math.floor(x);
  return Math.round(min + t * (max - min));
}

// ─── Period helpers ──────────────────────────────────────────────────────────

function diffDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function fmtDateLong(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Mock generators ─────────────────────────────────────────────────────────
// Replace each function body with real SQLite/IPC calls later.

function computeMetrics(label: string, dayCount: number, seed: number): DashboardMetrics {
  const scale = dayCount;
  const gross = seededRnd(seed, 130000, 200000) * scale;
  const refunds = seededRnd(seed + 1, 0, 5000) * scale;
  const expenses = seededRnd(seed + 2, 8000, 20000) * scale;
  const bills = seededRnd(seed + 3, 400, 700) * scale;
  const returns = seededRnd(seed + 4, 1000, 6000) * scale;
  const credit = seededRnd(seed + 5, 15000, 35000) * scale;
  const pending = Math.round(credit * seededRnd(seed + 6, 40, 80) / 100);
  const kg = seededRnd(seed + 7, 600, 1200) * scale;
  const online = seededRnd(seed + 8, 200, 1500) * scale;
  const net = gross - refunds;
  const avgBill = bills > 0 ? Math.round(net / bills) : 0;
  const cashCollected = net - online - credit;

  return {
    grossSales: gross,
    refunds,
    netSales: net,
    totalExpenses: expenses,
    totalBills: bills,
    returns,
    creditAdded: credit,
    pendingCredit: pending,
    totalSaleKg: kg,
    averageBill: avgBill,
    expectedCash: cashCollected + online,
    cashCollected,
    onlineSales: online,
    khataDues: 1115015,        // cumulative total, not filtered
    khataCustomerCount: 112,
    billsServed: bills,
  };
}

function computeRecentSales(label: string, seed: number): RecentSaleRow[] {
  const TYPES = ['Walk-in', 'Wholesale', 'Walk-in', 'Khata', 'Walk-in'];
  const PAYMENTS: RecentSaleRow['payment'][] = ['CASH', 'CASH', 'ONLINE', 'KHATA', 'CASH'];
  const COUNT = label === 'Today' || label === 'Yesterday' ? 5 : 8;

  return Array.from({ length: COUNT }, (_, i) => {
    const amount = seededRnd(seed + i * 7, 200, 3000);
    let timeLabel: string;
    if (label === 'Today' || label === 'Yesterday') {
      const h = 11 - i;
      timeLabel = `${h % 12 === 0 ? 12 : h % 12}:${String(seededRnd(seed + i, 0, 59)).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
    } else if (label === 'This Week') {
      const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      timeLabel = `${days[i % 7]} ${10 + i}:00`;
    } else {
      timeLabel = `${i + 1} Aug`;
    }
    return {
      id: i + 1,
      type: TYPES[i % TYPES.length],
      timeLabel,
      amount,
      payment: PAYMENTS[i % PAYMENTS.length],
    };
  });
}

function computeKhataCustomers(): KhataCustomer[] {
  // Khata outstanding is always the full list; filter could be applied later
  return [
    { id: 1, name: 'Ali Khan',     phone: '0300-1234567', amount: 45000, status: 'Overdue',  type: 'Wholesale'  },
    { id: 2, name: 'Zainab Stores',phone: '0321-9876543', amount: 32000, status: 'Due Soon', type: 'Retail'     },
    { id: 3, name: 'Usman Dairy',  phone: '0333-5556667', amount: 28500, status: 'Overdue',  type: 'Wholesale'  },
    { id: 4, name: 'Fatima',       phone: '0345-1112223', amount: 12000, status: 'On Track', type: 'Individual' },
  ].sort((a, b) => b.amount - a.amount) as KhataCustomer[];
}

function computeRevenueChart(
  label: string,
  startDate: Date,
  endDate: Date,
  seed: number,
): { data: RevenueDataPoint[]; interval: 'hourly' | 'daily'; titleSuffix: string; subtitle: string } {
  if (label === 'Today') {
    const now = new Date();
    const data = Array.from({ length: 7 }, (_, idx) => {
      const h = new Date(now);
      h.setHours(now.getHours() - (6 - idx), 0, 0, 0);
      const hr = h.getHours();
      return {
        label: `${hr % 12 === 0 ? 12 : hr % 12}${hr >= 12 ? 'PM' : 'AM'}`,
        value: seededRnd(seed + idx, 10000, 28000),
      };
    });
    return { data, interval: 'hourly', titleSuffix: 'Today', subtitle: 'Hourly revenue — last 7 hours' };
  }

  if (label === 'Yesterday') {
    const data = Array.from({ length: 24 }, (_, h) => ({
      label: `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'PM' : 'AM'}`,
      value: seededRnd(seed + h, 5000, 22000),
    }));
    return { data, interval: 'hourly', titleSuffix: 'Yesterday', subtitle: 'Hourly revenue — 24-hour cycle' };
  }

  if (label === 'This Week') {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const dow = today.getDay();
    const count = dow === 0 ? 1 : dow;
    const data = Array.from({ length: count }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (count - 1 - i));
      return { label: dayNames[d.getDay()], value: seededRnd(seed + i, 80000, 220000) };
    });
    return { data, interval: 'daily', titleSuffix: 'This Week', subtitle: 'Daily revenue — current week' };
  }

  if (label === 'This Month') {
    const today = new Date();
    const data = Array.from({ length: today.getDate() }, (_, i) => ({
      label: `${i + 1}`,
      value: seededRnd(seed + i, 70000, 210000),
    }));
    return { data, interval: 'daily', titleSuffix: 'This Month', subtitle: 'Daily revenue — current month' };
  }

  // Custom range
  const days = diffDays(startDate, endDate);
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (days <= 1) {
    const data = Array.from({ length: 24 }, (_, h) => ({
      label: `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'PM' : 'AM'}`,
      value: seededRnd(seed + h, 5000, 22000),
    }));
    return { data, interval: 'hourly', titleSuffix: `${fmtDate(startDate)}`, subtitle: 'Hourly revenue' };
  }

  const cap = Math.min(days, 31);
  const data = Array.from({ length: cap }, (_, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const lbl = days <= 7 ? DAY_NAMES[d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`;
    return { label: lbl, value: seededRnd(seed + i, 70000, 210000) };
  });
  return {
    data,
    interval: 'daily',
    titleSuffix: `${fmtDate(startDate)} – ${fmtDate(endDate)}`,
    subtitle: 'Daily revenue',
  };
}

// ─── Main hook ───────────────────────────────────────────────────────────────

export function useDashboardData(dateFilter: DateFilterType): DashboardData {
  return useMemo(() => {
    const { label } = dateFilter;
    const start = dateFilter.startDate ?? new Date();
    const end = dateFilter.endDate ?? new Date();

    // Seed is based on label so values stay stable until filter changes
    const seed = label.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);

    // How many days does this period represent?
    let dayCount = 1;
    let periodLabel = label.toLowerCase();
    let periodSummary = fmtDateLong(new Date());

    if (label === 'Today') {
      dayCount = 1;
      periodSummary = fmtDateLong(new Date());
    } else if (label === 'Yesterday') {
      dayCount = 1;
      const y = new Date();
      y.setDate(y.getDate() - 1);
      periodSummary = fmtDateLong(y);
    } else if (label === 'This Week') {
      dayCount = new Date().getDay() || 7;
      periodSummary = 'Current week';
    } else if (label === 'This Month') {
      dayCount = new Date().getDate();
      periodSummary = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    } else {
      dayCount = diffDays(start, end);
      periodLabel = 'selected range';
      periodSummary = `${fmtDate(start)} – ${fmtDate(end)}`;
    }

    const metrics = computeMetrics(label, dayCount, seed);
    const recentSales = computeRecentSales(label, seed);
    const khataCustomers = computeKhataCustomers();
    const { data: revenueChart, interval: chartInterval, titleSuffix: chartTitleSuffix, subtitle: chartSubtitle } =
      computeRevenueChart(label, start, end, seed);

    return {
      metrics,
      recentSales,
      khataCustomers,
      revenueChart,
      chartInterval,
      chartTitleSuffix,
      chartSubtitle,
      periodLabel,
      periodSummary,
    };
  }, [dateFilter.label, dateFilter.startDate?.toISOString(), dateFilter.endDate?.toISOString()]);
}
