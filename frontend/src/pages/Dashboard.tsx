import React, { useState, useRef, useEffect } from 'react';
import { WelcomeCard } from '../components/dashboard/WelcomeCard';
import { PaceCard } from '../components/dashboard/PaceCard';
import { StatCard } from '../components/dashboard/StatCard';
import { WeeklyRevenue } from '../components/dashboard/WeeklyRevenue';
import { RecentSales } from '../components/dashboard/RecentSales';
import { Analysis } from '../components/dashboard/Analysis';
import { OutstandingCustomers } from '../components/dashboard/OutstandingCustomers';
import { TrendingUp, FileText, Banknote, Wallet, CreditCard, AlertCircle, Calendar as CalendarIcon } from 'lucide-react';
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
          revenueChart, isLoading, error } = data;

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
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 text-slate-800 font-semibold">
          <CalendarIcon className="w-5 h-5 text-blue-600" />
          <span>Dashboard Overview</span>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => { setDateFilter({ label: preset.label, startDate: new Date(), endDate: new Date() }); setShowCustomPicker(false); }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                dateFilter.label === preset.label ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}

          <div>
            <button
              ref={buttonRef}
              onClick={() => setShowCustomPicker(!showCustomPicker)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                isCustom ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {isCustom ? dateFilter.label : 'Custom'}
            </button>

            {showCustomPicker && (
              <div ref={popupRef} style={popupStyle} className="bg-white rounded-xl shadow-xl border border-slate-200 p-4 flex flex-col gap-3 min-w-[280px]">
                <h4 className="text-sm font-bold text-slate-800">Select Custom Range</h4>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">Start Date</label>
                  <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-slate-500">End Date</label>
                  <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="flex justify-end gap-2 mt-2">
                  <button onClick={() => setShowCustomPicker(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Cancel</button>
                  <button onClick={handleApplyCustom} disabled={!customStart || !customEnd}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">Apply</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Loading / Error Banner ────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white border border-slate-100 rounded-xl px-4 py-3 shadow-sm">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          Loading dashboard data…
        </div>
      )}
      {error && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-4 py-3">
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
          bgColor="bg-white"
          iconColor="text-slate-400"
        />
        <StatCard
          title="Bills Served"
          value={metrics.totalBills.toLocaleString()}
          subtitle="Receipts issued"
          icon={FileText}
          bgColor="bg-[#F4F8FF]"
          iconColor="text-blue-500"
        />
        <StatCard
          title="Expected Cash"
          value={fmt(metrics.expectedCash)}
          subtitle="Register total"
          icon={Banknote}
          bgColor="bg-[#F5F3FF]"
          iconColor="text-purple-500"
        />
        <StatCard
          title="Cash Collected"
          value={fmt(metrics.cashCollected)}
          subtitle="Cash tender"
          icon={Wallet}
          bgColor="bg-[#FFF1F2]"
          iconColor="text-rose-500"
        />
        <StatCard
          title="Online Sales"
          value={fmt(metrics.onlineSales)}
          subtitle="JazzCash / bank"
          icon={CreditCard}
          bgColor="bg-[#F0FDF4]"
          iconColor="text-emerald-500"
        />
        <StatCard
          title="Khata Dues"
          value={fmt(metrics.khataDues)}
          subtitle={`${metrics.khataCustomerCount} customers owe`}
          icon={AlertCircle}
          bgColor="bg-[#FFFBEB]"
          iconColor="text-amber-500"
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
