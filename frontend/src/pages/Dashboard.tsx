import React, { useState, useRef, useEffect } from 'react';
import { WelcomeCard } from '../components/dashboard/WelcomeCard';
import { PaceCard } from '../components/dashboard/PaceCard';
import { StatCard } from '../components/dashboard/StatCard';
import { WeeklyRevenue } from '../components/dashboard/WeeklyRevenue';
import { RecentSales } from '../components/dashboard/RecentSales';
import { Analysis } from '../components/dashboard/Analysis';
import { OutstandingCustomers } from '../components/dashboard/OutstandingCustomers';
import { TrendingUp, FileText, Banknote, Wallet, CreditCard, AlertCircle, Calendar as CalendarIcon, CheckCircle2, RefreshCw } from 'lucide-react';
import { DateFilterType } from '../types';
import { useDashboardData } from '../hooks/useDashboardData';

const presets = [
  { label: 'Today' },
  { label: 'Yesterday' },
  { label: 'This Week' },
  { label: 'This Month' },
];

export const Dashboard: React.FC = () => {
  const [dateFilter, setDateFilter] = useState<DateFilterType>({
    label: 'Today',
    startDate: new Date(),
    endDate: new Date(),
  });

  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({
    opacity: 0, pointerEvents: 'none', position: 'fixed', left: -9999, top: -9999,
  });

  // ── All dashboard data derived from a single dateFilter ─────────────────
  const data = useDashboardData(dateFilter);
  const { metrics, recentSales, khataCustomers,
          chartTitleSuffix, chartSubtitle, periodLabel, periodSummary,
          revenueChart, isLoading, error, refresh } = data;

  // Show a brief "Done" toast after loading finishes
  const [showDone, setShowDone] = React.useState(false);
  const prevLoading = React.useRef(false);
  React.useEffect(() => {
    if (prevLoading.current && !isLoading && !error) {
      setShowDone(true);
      const t = setTimeout(() => setShowDone(false), 2000);
      return () => clearTimeout(t);
    }
    prevLoading.current = isLoading;
  }, [isLoading, error]);

  useEffect(() => {
    if (showCustomPicker && buttonRef.current && popupRef.current) {
      const br = buttonRef.current.getBoundingClientRect();
      const pr = popupRef.current.getBoundingClientRect();
      let top = br.bottom + 8;
      let left = br.right - pr.width;
      if (left < 16) left = br.left;
      if (left + pr.width > window.innerWidth - 16) left = window.innerWidth - pr.width - 16;
      if (top + pr.height > window.innerHeight - 16) top = br.top - pr.height - 8;
      setPopupStyle({ position: 'fixed', top, left, zIndex: 9999, opacity: 1, pointerEvents: 'auto', transition: 'opacity 0.15s ease-out' });
    } else {
      setPopupStyle({ opacity: 0, pointerEvents: 'none', position: 'fixed', left: -9999, top: -9999 });
    }
  }, [showCustomPicker]);

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      const start = new Date(customStart);
      const end = new Date(customEnd);
      const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      setDateFilter({ label: `${fmt(start)} – ${fmt(end)}`, startDate: start, endDate: end });
      setShowCustomPicker(false);
    }
  };

  const isCustom = !presets.some((p) => p.label === dateFilter.label);

  const fmt = (n: number) => `Rs. ${n.toLocaleString()}`;

  return (
    <div className="flex flex-col gap-6 relative">

      {/* ── Date Filter Bar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#1a2e1f] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-[#2d4a35]">
        <div className="flex items-center gap-2 text-slate-800 dark:text-[#e2f5e8] font-semibold">
          <CalendarIcon className="w-5 h-5 text-[#166534] dark:text-[#22c55e]" />
          <span>Dashboard Overview</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => { setDateFilter({ label: preset.label, startDate: new Date(), endDate: new Date() }); setShowCustomPicker(false); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                dateFilter.label === preset.label
                  ? 'bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-sm font-semibold'
                  : 'bg-slate-100 dark:bg-[#1e3124] text-slate-600 dark:text-[#7aab84] hover:bg-[#FEF3C7]/60 dark:hover:bg-[#22c55e]/10 hover:text-[#166534] dark:hover:text-[#86efac]'
              }`}
            >
              {preset.label}
            </button>
          ))}

          <div>
            <button
              ref={buttonRef}
              onClick={() => setShowCustomPicker(!showCustomPicker)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                isCustom
                  ? 'bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-sm font-semibold'
                  : 'bg-white dark:bg-[#1e3124] border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#7aab84] hover:bg-[#FEF3C7]/50 dark:hover:bg-[#22c55e]/10 hover:text-[#166534] dark:hover:text-[#86efac]'
              }`}
            >
              {isCustom ? dateFilter.label : 'Custom'}
            </button>

            {showCustomPicker && (
              <div ref={popupRef} style={popupStyle} className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xl border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col gap-3 min-w-[280px]">
                <h4 className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">Select Custom Range</h4>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-[#64916e]">Start Date</label>
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-[#2d4a35] rounded-lg text-sm text-slate-700 dark:text-[#e2f5e8] bg-white dark:bg-[#1e3124] focus:outline-none focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#22c55e]" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-[#64916e]">End Date</label>
                  <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-[#2d4a35] rounded-lg text-sm text-slate-700 dark:text-[#e2f5e8] bg-white dark:bg-[#1e3124] focus:outline-none focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#22c55e]" />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setShowCustomPicker(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors">Cancel</button>
                  <button onClick={handleApplyCustom} disabled={!customStart || !customEnd}
                    className="px-3 py-1.5 text-xs font-semibold bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] rounded-lg hover:bg-[#14532d] dark:hover:bg-[#16a34a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs">Apply</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Top progress bar (fixed, full-width) ──────────────────────── */}
      {isLoading && (
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, height: 3 }}
        >
          <div
            style={{
              height: '100%',
              background: 'linear-gradient(90deg, #166534, #22c55e, #166534)',
              backgroundSize: '200% 100%',
              animation: 'dashProgress 1.2s linear infinite',
            }}
          />
          <style>{`
            @keyframes dashProgress {
              0%   { background-position: 200% center; }
              100% { background-position: -200% center; }
            }
          `}</style>
        </div>
      )}

      {/* ── Floating refresh toast (bottom-right) ─────────────────────── */}
      {(isLoading || showDone) && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9998,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: isLoading ? '#166534' : '#15803d',
            color: '#fff',
            borderRadius: 12,
            padding: '10px 16px',
            fontSize: 13,
            fontWeight: 600,
            boxShadow: '0 8px 32px rgba(22,101,52,0.25)',
            transition: 'opacity 0.3s ease',
            opacity: isLoading || showDone ? 1 : 0,
          }}
        >
          {isLoading ? (
            <>
              <RefreshCw style={{ width: 15, height: 15, animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              Refreshing dashboard…
            </>
          ) : (
            <>
              <CheckCircle2 style={{ width: 15, height: 15 }} />
              Data updated!
            </>
          )}
        </div>
      )}

      {/* ── Error Banner ──────────────────────────────────────────────── */}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/40 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Welcome + Pace ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WelcomeCard
            dateFilter={dateFilter}
            grossSales={metrics.grossSales}
            refunds={metrics.refunds}
            netSales={metrics.netSales}
            periodSummary={periodSummary}
            isLoading={isLoading}
            onRefresh={refresh}
          />
        </div>
        <div>
          <PaceCard
            dateFilter={dateFilter}
            billsServed={metrics.billsServed}
            averageBill={metrics.averageBill}
          />
        </div>
      </div>

      {/* ── Stat Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Net Sales"
          value={fmt(metrics.netSales)}
          subtitle="After refunds"
          icon={TrendingUp}
          trendIcon={TrendingUp}
          bgColor="bg-white dark:bg-[#1a2e1f]"
          iconColor="text-slate-400 dark:text-[#64916e]"
        />
        <StatCard
          title="Bills Served"
          value={metrics.totalBills.toLocaleString()}
          subtitle="Receipts issued"
          icon={FileText}
          bgColor="bg-[#F4F8FF] dark:bg-[#162535]"
          iconColor="text-blue-500 dark:text-blue-400"
        />
        <StatCard
          title="Expected Cash"
          value={fmt(metrics.expectedCash)}
          subtitle="Register total"
          icon={Banknote}
          bgColor="bg-[#F5F3FF] dark:bg-[#1e1a35]"
          iconColor="text-purple-500 dark:text-purple-400"
        />
        <StatCard
          title="Cash Collected"
          value={fmt(metrics.cashCollected)}
          subtitle="Cash tender"
          icon={Wallet}
          bgColor="bg-[#FFF1F2] dark:bg-[#2d1515]"
          iconColor="text-rose-500 dark:text-rose-400"
        />
        <StatCard
          title="Online Sales"
          value={fmt(metrics.onlineSales)}
          subtitle="JazzCash / bank"
          icon={CreditCard}
          bgColor="bg-[#F0FDF4] dark:bg-[#1a2e1f]"
          iconColor="text-emerald-500 dark:text-emerald-400"
        />
        <StatCard
          title="Khata Dues"
          value={fmt(metrics.khataDues)}
          subtitle={`${metrics.khataCustomerCount} customers owe`}
          icon={AlertCircle}
          bgColor="bg-[#FFFBEB] dark:bg-[#2a1f0a]"
          iconColor="text-amber-500 dark:text-amber-400"
        />
      </div>

      {/* ── Revenue Chart + Recent Sales ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <WeeklyRevenue
            dateFilter={dateFilter}
            data={revenueChart ?? []}
            isLoading={isLoading && (!revenueChart || revenueChart.length === 0)}
            titleSuffix={chartTitleSuffix}
            subtitle={chartSubtitle}
          />
        </div>
        <div>
          <RecentSales
            dateFilter={dateFilter}
            sales={recentSales}
          />
        </div>
      </div>

      {/* ── Analysis + Outstanding Khata ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2">
          <Analysis
            dateFilter={dateFilter}
            metrics={metrics}
          />
        </div>
        <div>
          <OutstandingCustomers
            dateFilter={dateFilter}
            customers={khataCustomers}
          />
        </div>
      </div>

    </div>
  );
};
