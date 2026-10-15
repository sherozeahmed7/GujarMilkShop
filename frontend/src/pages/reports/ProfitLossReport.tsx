import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DateFilterType } from '../../types';
import { getProfitAndLossReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { LoadingState, EmptyState, ErrorState, ReportErrorBoundary } from '../../components/reports/ReportStates';
import {
  TrendingUp,
  TrendingDown,
  ReceiptText,
  Percent,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  PieChart as PieChartIcon,
  Tag,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Boxes,
  RotateCcw,
  BadgeDollarSign,
  Truck,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartTheme } from '../../hooks/useChartTheme';

export const ProfitLossReport: React.FC = () => {
  const { grid, axis, tooltipStyle, tooltipLabelStyle } = useChartTheme();
  const [filter, setFilter] = useState<DateFilterType>({
    label: 'This Month',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(),
  });

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const requestId = useRef(0);
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const fetchReport = useCallback(async (currentFilter: DateFilterType, quiet = false) => {
    const id = ++requestId.current;
    if (!quiet) setIsLoading(true);
    try {
      const result = await getProfitAndLossReport(currentFilter);
      if (id === requestId.current) { setData(result); setError(null); }
    } catch (e: any) {
      if (id === requestId.current) setError(e?.message || 'Failed to load Profit & Loss report.');
      console.error(e);
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchReport(filter);
  }, [filter, fetchReport]);

  // Background polling — separate from filter-triggered fetch
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void fetchReport(filterRef.current, true);
    };
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [fetchReport]);

  const loadReport = () => { void fetchReport(filter); };

  const fmt = (n: number | undefined | null) => {
    const val = Number(n ?? 0);
    if (isNaN(val) || !isFinite(val)) return 'Rs. 0.00';
    return `Rs. ${val.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fmtQty = (n: number | undefined | null) => {
    const val = Number(n ?? 0);
    if (isNaN(val) || !isFinite(val)) return '0.000';
    return val.toLocaleString('en-PK', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
  };

  const isNetProfit = (data?.summary?.netProfit ?? 0) >= 0;
  const isGrossProfit = (data?.summary?.grossProfit ?? 0) >= 0;

  const exportData = data
    ? [
        { item: 'Gross Sales', amount: data.summary.grossSales },
        { item: 'Total Discounts', amount: -data.summary.discounts },
        { item: 'Total Returns / Refunds', amount: -data.summary.returns },
        { item: 'Net Sales', amount: data.summary.netSales },
        { item: 'Cost of Goods Sold (COGS)', amount: -data.summary.cogs },
        { item: 'Gross Profit', amount: data.summary.grossProfit },
        { item: 'Gross Margin %', amount: `${data.summary.grossMargin}%` },
        { item: 'Operating Expenses', amount: -data.summary.totalExpenses },
        { item: 'Net Profit / (Loss)', amount: data.summary.netProfit },
        { item: 'Net Profit Margin %', amount: `${data.summary.netProfitMargin}%` },
        { item: 'Total Amount Collected', amount: data.summary.amountCollected },
        { item: 'Borrow / Unpaid Amount (selected sales, still owed)', amount: data.summary.borrowedAmount },
        { item: 'Cash in Hand (current drawer balance)', amount: data.summary.cashInHand ?? 'Unavailable' },
        { item: 'Drawer Balance Basis', amount: data.summary.cashInHandBasis },
        { item: 'Drawer Balance As Of', amount: data.summary.cashInHandAsOf },
        ...Object.entries(data.summary.drawerCashBreakdown ?? {}).map(([item, amount]) => ({ item: `Drawer: ${item}`, amount })),
        { item: 'Total Cash in Hand (All Time)', amount: data.summary.totalCashInHand ?? 'Unavailable' },
        { item: 'Total Drawer Balance Basis', amount: data.summary.totalCashInHandBasis },
        { item: 'Milk Inventory Cost per kg (current)', amount: data.summary.milkInventoryUnitCost },
        { item: 'F2 cost allocation method', amount: 'Lassi revenue recovers daily milk cost; remainder goes to butter' },
        { item: 'F2 cost completeness', amount: data.summary.f2CostComplete === false ? 'Incomplete: missing production/cost records' : 'Complete' },
        ...(data.f2CostAllocation?.batches || []).flatMap((batch: any) => [
          { item: `${batch.date} F2 milk cost (${batch.milkKg} kg)`, amount: batch.milkCost },
          { item: `${batch.date} Lassi revenue after refunds`, amount: batch.lassiRevenue },
          { item: `${batch.date} Milk cost recovered by Lassi${batch.provisional ? ' — day end pending' : ''}`, amount: batch.lassiCost },
          { item: `${batch.date} Lassi profit${batch.provisional ? ' — day end pending' : ''}`, amount: batch.lassiProfit },
          { item: `${batch.date} Remaining cost in butter (${batch.butterKg} kg)`, amount: batch.butterCost },
          { item: `${batch.date} Butter cost per kg`, amount: batch.butterUnitCost },
          { item: `${batch.date} Cost awaiting butter production`, amount: batch.unallocatedCost },
        ]),
        { item: 'Number of Sales', amount: data.summary.numberOfSales },
        { item: 'Number of Returns', amount: data.summary.numberOfReturns },
      ]
    : [];

  return (
    <ReportErrorBoundary reportName="Profit & Loss">
    <ReportLayout>
      <ReportHeader
        title="Profit & Loss Statement"
        description="Sales, unpaid bills, product costs and expenses for the selected period, with the current cash drawer balance."
        exportData={exportData}
        exportColumns={[
          { header: 'Financial Item', dataKey: 'item' },
          { header: 'Amount / Value', dataKey: 'amount' },
        ]}
        exportSummary={
          data
            ? {
                GrossSales: fmt(data.summary.grossSales),
                Discounts: fmt(data.summary.discounts),
                Returns: fmt(data.summary.returns),
                NetSales: fmt(data.summary.netSales),
                COGS: fmt(data.summary.cogs),
                GrossProfit: fmt(data.summary.grossProfit),
                Expenses: fmt(data.summary.totalExpenses),
                SupplierPaid: fmt(data.summary.totalSupplierPaid),
                AllTimeSupplierPaid: fmt(data.summary.allTimeSupplierPaid),
                NetProfit: fmt(data.summary.netProfit),
                NetMargin: `${data.summary.netProfitMargin}%`,
                UnpaidAmount: fmt(data.summary.borrowedAmount),
                CashInHand: data.summary.cashInHand == null ? 'Unavailable' : fmt(data.summary.cashInHand),
                TotalCashInHand: data.summary.totalCashInHand == null ? 'Unavailable' : fmt(data.summary.totalCashInHand),
              }
            : undefined
        }
      />

      <ReportFilters
        currentFilter={filter}
        onFilterChange={setFilter}
        onRefresh={loadReport}
        isLoading={isLoading}
      />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <div className="space-y-6">
          {data.summary.f2CostComplete === false && <p className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-[#2a2414] p-3 text-sm text-amber-800 dark:text-amber-300">Some F2 production or cost records are missing. Profit figures are provisional; see the F2 cost breakdown below.</p>}
          {data.summary.f2DayEndPending && <p className="rounded-lg border border-sky-200 bg-sky-50 dark:bg-[#142431] p-3 text-sm text-sky-800 dark:text-sky-200">Today's F2 costs and profit are provisional until day end. Completed-day results are shown separately in the daily recovery breakdown.</p>}
          {/* ── 1. TOP FINANCIAL SUMMARY CARDS ── */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba895] mb-3">
              Executive Financial Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
              {/* Gross Sales */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Gross Sales</span>
                  <ReceiptText className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-blue-700 dark:text-blue-400">
                    {fmt(data.summary.grossSales)}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#64916e] mt-0.5">
                    Pre-discount total
                  </div>
                </div>
              </div>

              {/* Discounts */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Discounts</span>
                  <Tag className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-amber-700 dark:text-amber-400">
                    {fmt(data.summary.discounts)}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#64916e] mt-0.5">
                    POS &amp; Khata write-offs
                  </div>
                </div>
              </div>

              {/* Returns */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Returns</span>
                  <RotateCcw className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-rose-700 dark:text-rose-400">
                    {fmt(data.summary.returns)}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#64916e] mt-0.5">
                    {data.summary.numberOfReturns} {data.summary.numberOfReturns === 1 ? 'return' : 'returns'} refunded
                  </div>
                </div>
              </div>

              {/* Net Sales */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col justify-between ring-1 ring-slate-300 dark:ring-[#2d4a35]">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-[#e2f5e8]">Net Sales</span>
                  <BadgeDollarSign className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-slate-900 dark:text-[#e2f5e8]">
                    {fmt(data.summary.netSales)}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#64916e] mt-0.5">
                    Gross − Disc − Returns
                  </div>
                </div>
              </div>

              {/* COGS */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Product Cost (COGS)</span>
                  <Boxes className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-amber-800 dark:text-amber-400">
                    {fmt(data.summary.cogs)}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#64916e] mt-0.5">
                    Milk cost: sold kg × current Inventory Cost
                  </div>
                </div>
              </div>

              {/* Gross Profit */}
              <div
                className={`rounded-xl shadow-xs border p-4 flex flex-col justify-between ${
                  isGrossProfit
                    ? 'bg-emerald-50/70 dark:bg-[#14291a] border-emerald-300 dark:border-[#22c55e]/40'
                    : 'bg-rose-50/70 dark:bg-[#2e1518] border-rose-300 dark:border-rose-800/40'
                }`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-[#e2f5e8]">Gross Profit</span>
                  {isGrossProfit ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  )}
                </div>
                <div>
                  <div
                    className={`text-lg font-black ${
                      isGrossProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {fmt(data.summary.grossProfit)}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-[#a7c4ae] mt-0.5">
                    Margin: {Number(data.summary.grossMargin || 0).toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Total Expenses */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Operating Expenses</span>
                  <Wallet className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-rose-700 dark:text-rose-400">
                    {fmt(data.summary.totalExpenses)}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#64916e] mt-0.5">
                    Period operating costs
                  </div>
                </div>
              </div>

              {/* Net Profit / Loss */}
              <div
                className={`rounded-xl shadow-sm border p-4 flex flex-col justify-between col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-1 xl:col-span-2 ${
                  isNetProfit
                    ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white border-emerald-600 shadow-emerald-500/20'
                    : 'bg-gradient-to-br from-rose-600 to-red-700 text-white border-rose-700 shadow-rose-600/20'
                }`}
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-100">
                    {isNetProfit ? 'NET PROFIT' : 'NET LOSS'}
                  </span>
                  {isNetProfit ? (
                    <ArrowUpRight className="w-5 h-5 text-white" />
                  ) : (
                    <ArrowDownRight className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tight">{fmt(data.summary.netProfit)}</div>
                  <div className="text-xs font-medium text-white/90 mt-0.5">
                    Net Profit Margin: {Number(data.summary.netProfitMargin || 0).toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* Amount Collected */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Amount Collected</span>
                  <Wallet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-blue-700 dark:text-blue-400">
                    {fmt(data.summary.amountCollected)}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#64916e] mt-0.5">
                    Cash &amp; Online received
                  </div>
                </div>
              </div>

              {/* Total Paid to Suppliers */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Paid to Suppliers</span>
                  <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-amber-700 dark:text-amber-400">
                    {fmt(data.summary.totalSupplierPaid)}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#64916e] mt-0.5">
                    Cleared in period {data.summary.supplierPaymentsCount ? `(${data.summary.supplierPaymentsCount} ${data.summary.supplierPaymentsCount === 1 ? 'payment' : 'payments'})` : ''}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-[#8ba895] mt-1 pt-1 border-t border-slate-100 dark:border-[#2d4a35]">
                    All-Time Paid: {fmt(data.summary.allTimeSupplierPaid)}
                  </div>
                </div>
              </div>

              {/* Number of Sales */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Borrow / Unpaid Amount</div>
                <div className="mt-2 text-lg font-extrabold text-amber-700 dark:text-amber-400">{fmt(data.summary.borrowedAmount)}</div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-[#8ba895]">Still owed on selected-period sales · all items</div>
              </div>
              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Cash in Hand</div>
                <div className="mt-2 text-lg font-extrabold text-emerald-700 dark:text-emerald-400">{data.summary.cashInHand == null ? 'Unavailable' : fmt(data.summary.cashInHand)}</div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-[#8ba895]">Cash for selected period (sales − expenses &amp; payments)</div>
                {data.summary.drawerCashBreakdown ? (
                  <details className="mt-2 text-xs text-slate-600 dark:text-[#a7c4ae]">
                    <summary className="cursor-pointer">View calculation</summary>
                    <div className="mt-2 space-y-1">
                      <p>{data.summary.cashInHandBasis}</p>
                      {[
                        ['+ Cash from sales', data.summary.drawerCashBreakdown.salesCash],
                        ['+ Other cash received', data.summary.drawerCashBreakdown.otherReceived],
                        ['− Expenses paid', data.summary.drawerCashBreakdown.expensePayments],
                        ['− Suppliers paid', data.summary.drawerCashBreakdown.supplierPayments],
                        ['− Cash refunds', data.summary.drawerCashBreakdown.refunds],
                        ['− Other cash paid', data.summary.drawerCashBreakdown.otherPaid],
                      ].map(([label, amount]) => <div key={label} className="flex justify-between gap-2"><span>{label}</span><span>{fmt(amount)}</span></div>)}
                    </div>
                  </details>
                ) : <p className="mt-1 text-xs text-amber-600">{data.summary.cashInHandBasis}</p>}
              </div>

              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4">
                <div className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Total Cash in Hand (All Time)</div>
                <div className="mt-2 text-lg font-extrabold text-emerald-700 dark:text-emerald-400">{data.summary.totalCashInHand == null ? 'Unavailable' : fmt(data.summary.totalCashInHand)}</div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-[#8ba895]">{data.summary.totalCashInHandBasis}</div>
              </div>

              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Number of Sales</span>
                  <ReceiptText className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-slate-800 dark:text-[#e2f5e8]">
                    {data.summary.numberOfSales}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#64916e] mt-0.5">
                    Completed bill transactions
                  </div>
                </div>
              </div>

              {/* Number of Returns */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xs border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">Number of Returns</span>
                  <RotateCcw className="w-4 h-4 text-slate-400" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-slate-800 dark:text-[#e2f5e8]">
                    {data.summary.numberOfReturns}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-[#64916e] mt-0.5">
                    Sales returns processed
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── 2. CHARTS (REVENUE VS COST & DAILY TREND) ── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Daily Revenue Trend</h3>
              <p className="text-xs text-slate-400 dark:text-[#64916e] mt-0.5">
                Net recorded revenue for each day in the selected range
              </p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.revVsCost}>
                    <defs>
                      <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: axis }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: axis }}
                      tickFormatter={(value: number) => `Rs.${value}`}
                    />
                    <RechartsTooltip
                      formatter={(value) => fmt(Number(value ?? 0))}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="#2563EB"
                      fill="url(#salesFill)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Revenue vs Product Cost (COGS)</h3>
              <p className="text-xs text-slate-400 dark:text-[#64916e] mt-0.5">
                Daily comparison of net sales against cost of products sold
              </p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.revVsCost}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: axis }} />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fill: axis }}
                      tickFormatter={(value: number) => `Rs.${value}`}
                    />
                    <RechartsTooltip
                      formatter={(value) => fmt(Number(value ?? 0))}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                    />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cost" name="COGS" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* ── 3. DETAILED PRODUCT PROFITABILITY SECTION (DYNAMIC TABLE) ── */}
          <section className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-[#2d4a35] flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Dynamic Product Profitability</h3>
                <p className="text-xs text-slate-400 dark:text-[#64916e] mt-0.5">
                  Breakdown by sold product based on actual quantity, revenue, unit cost, and margin
                </p>
                <p className="text-xs text-slate-500 dark:text-[#8ba895] mt-1">
                  {data.summary.milkCostAvailable
                    ? `Current milk Inventory Cost: ${fmt(data.summary.milkInventoryUnitCost)}/kg. F2 uses the milk cost recorded up to each production day. Lassi recovers that day's milk cost first; butter carries the remainder.`
                    : 'Milk Inventory Cost is unavailable. Milk-based product cost is currently zero until a cost is recorded in Inventory.'}
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-slate-100 dark:bg-[#142119] text-slate-600 dark:text-[#a7c4ae] rounded-md">
                {data.productProfitability?.length || 0} active products
              </span>
            </div>

            <div className="px-5 pb-4 space-y-2 text-xs text-slate-600 dark:text-[#a7c4ae]">
              <p>Daily recovery updates every 10 seconds. Lassi resets daily; butter and ghee carry their remaining cost forward. Today's result is provisional until the next day.</p>
              {data.f2CostAllocation?.warnings?.length > 0 && (
                <details className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-[#2a2414] p-3">
                  <summary className="cursor-pointer font-semibold text-amber-700">F2 cost is incomplete — missing production or cost records</summary>
                  <ul className="mt-2 list-disc pl-5">{data.f2CostAllocation.warnings.map((warning: string) => <li key={warning}>{warning}</li>)}</ul>
                </details>
              )}
              <details className="rounded-lg border border-slate-200 dark:border-[#2d4a35] p-3">
                <summary className="cursor-pointer font-semibold">Daily Lassi recovery &amp; butter cost</summary>
                <p className="mt-2">Milk cost = milk set aside × milk cost/kg for that day. Lassi recovery = the smaller of net Lassi sales and milk cost. Remaining milk cost = milk cost − Lassi recovery. Butter cost/kg = remaining milk cost ÷ today's butter produced.</p>
                <p className="mt-2">Lassi profit = net Lassi sales − recovered milk cost. Recovery uses recorded sales after refunds, including credit sales; cash collection is separate. If Lassi covers all milk cost, butter's remaining milk cost is zero. Ghee inherits the cost of butter converted. Past days recalculate only when their underlying records are corrected.</p>
                <div className="mt-3 space-y-3">
                  {(data.f2CostAllocation?.batches || []).map((batch: any) => (
                    <div key={batch.date} className="rounded bg-slate-50 dark:bg-[#142119] p-3 space-y-1">
                      <p className="font-bold">{batch.date}{batch.provisional ? ' · Day end pending' : ' · Completed day'}</p>
                      <p>Milk: {fmtQty(batch.milkKg)} kg × {fmt(batch.milkUnitCost)} = {fmt(batch.milkCost)}</p>
                      <p>Lassi revenue after refunds: {fmt(batch.lassiRevenue)}</p>
                      <p>Milk cost recovered by Lassi: min(max({fmt(batch.lassiRevenue)}, Rs. 0), {fmt(batch.milkCost)}) = {fmt(batch.lassiCost)}</p>
                      <p>Remaining milk cost: {fmt(batch.milkCost)} − {fmt(batch.lassiCost)} = {fmt(batch.milkCost - batch.lassiCost)}</p>
                      <p>Butter cost/kg: {batch.butterKg > 0 ? `${fmt(batch.butterCost)} ÷ ${fmtQty(batch.butterKg)} kg = ${fmt(batch.butterUnitCost)}/kg` : 'Awaiting butter production quantity'}</p>
                      <p>Lassi profit: {fmt(batch.lassiRevenue)} − {fmt(batch.lassiCost)} = {fmt(batch.lassiProfit)}{batch.provisional ? ' · Provisional, final after day end' : ''}</p>
                      <p>Reconciliation: Lassi cost {fmt(batch.lassiCost)} + butter cost {fmt(batch.butterCost)} + unallocated {fmt(batch.unallocatedCost)} = {fmt(batch.milkCost)}</p>
                    </div>
                  ))}
                  {(data.f2CostAllocation?.conversions || []).map((conversion: any, index: number) => (
                    <p key={index}>{conversion.date}: {fmtQty(conversion.butterKg)} kg butter transfers {fmt(conversion.transferredCost)} to {fmtQty(conversion.gheeKg)} kg ghee. Cost/kg = {fmt(conversion.transferredCost)} ÷ {fmtQty(conversion.gheeKg)} = Rs. {Number(conversion.gheeUnitCost).toLocaleString('en-PK', { maximumFractionDigits: 6 })}.</p>
                  ))}
                </div>
              </details>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-[#142119] text-slate-500 dark:text-[#8ba895] uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3 font-bold">Product</th>
                    <th className="px-5 py-3 text-right font-bold">Qty Sold (KG/Unit)</th>
                    <th className="px-5 py-3 text-right font-bold">Revenue</th>
                    <th className="px-5 py-3 text-right font-bold">COGS</th>
                    <th className="px-5 py-3 text-right font-bold">Gross Profit</th>
                    <th className="px-5 py-3 text-right font-bold">Gross Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {data.productProfitability && data.productProfitability.length > 0 ? (
                    data.productProfitability.map((p: any) => (
                      <React.Fragment key={p.product}>
                      <tr className="hover:bg-slate-50/50 dark:hover:bg-[#1e3424] transition-colors">
                        <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-[#e2f5e8]">
                          {p.displayName}
                          {p.calculationLines?.some((line: any) => line.provisional) && <span className="block mt-1 text-[10px] font-medium text-sky-600">Day end pending</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-slate-600 dark:text-[#a7c4ae]">
                          {fmtQty(p.quantitySold)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-semibold text-slate-800 dark:text-[#e2f5e8]">
                          {fmt(p.revenue)}
                        </td>
                        <td className="px-5 py-3.5 text-right text-amber-700 dark:text-amber-400 font-medium">
                          {fmt(p.cogs)}
                        </td>
                        <td
                          className={`px-5 py-3.5 text-right font-bold ${
                            p.grossProfit >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {fmt(p.grossProfit)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-medium">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              p.margin >= 20
                                ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
                                : p.margin >= 0
                                ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300'
                                : 'bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {Number(p.margin || 0).toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td colSpan={6} className="px-5 pb-3 text-xs text-slate-600 dark:text-[#a7c4ae]">
                          <details>
                            <summary className="cursor-pointer font-semibold">{p.displayName} calculation</summary>
                            <div className="mt-3 space-y-3 rounded-lg bg-slate-50 dark:bg-[#142119] p-3">
                              {['milk', 'yogurt', 'yog'].includes(p.product) && (
                                <p>Cost uses the current milk Inventory Cost: {fmt(data.summary.milkInventoryUnitCost)}/kg.
                                  {p.product !== 'milk' && ' Assumption: 1 kg of this product uses 1 kg of milk.'}
                                </p>
                              )}
                              {['lassi', 'butter', 'ghee'].includes(p.product) && <p>Lassi revenue recovers daily milk cost first. Unrecovered cost is carried by that day's butter, then transferred to ghee if converted. Unsold butter and ghee retain their cost.</p>}
                              <p>Revenue = sale line amounts − returned amounts. Product cost = sum of quantity × cost per kg for each sale, minus returned cost. Each line cost is rounded to two decimals.</p>
                              {p.calculationLines?.length > 0 && (
                                <div className="overflow-x-auto max-h-64">
                                  <table className="w-full text-left">
                                    <thead><tr><th className="py-1 pr-3">Entry</th><th className="py-1 pr-3">Quantity</th><th className="py-1 pr-3">Revenue</th><th className="py-1">Cost formula</th></tr></thead>
                                    <tbody>{p.calculationLines.map((line: any, index: number) => (
                                      <tr key={index}>
                                        <td className="py-1 pr-3">{line.kind} {index + 1}</td>
                                        <td className="py-1 pr-3">{fmtQty(line.quantity)} kg</td>
                                        <td className="py-1 pr-3">{line.kind === 'Return' ? '− ' : ''}{fmt(line.revenue)}</td>
                                        <td className="py-1">{line.kind === 'Return' ? 'Subtract: ' : ''}{fmtQty(line.quantity - (line.missingQuantity || 0))} × Rs. {Number(line.unitCost).toLocaleString('en-PK', { maximumFractionDigits: 6 })} ≈ {fmt(line.cost)}{line.missingQuantity > 0 ? ` · ${fmtQty(line.missingQuantity)} kg missing cost` : ''}{line.basis ? ` · ${line.basis}` : ''}</td>
                                      </tr>
                                    ))}</tbody>
                                  </table>
                                </div>
                              )}
                              <p><strong>Gross profit / loss</strong> = Revenue − Product cost = {fmt(p.revenue)} − {fmt(p.cogs)} = <strong>{fmt(p.grossProfit)}</strong></p>
                              <p><strong>Gross margin</strong> = Gross profit ÷ Revenue × 100
                                {p.revenue > 0 ? ` = ${fmt(p.grossProfit)} ÷ ${fmt(p.revenue)} × 100 = ${Number(p.margin).toFixed(2)}%` : ' — not defined when revenue is zero or negative (table displays 0%).'}
                              </p>
                            </div>
                          </details>
                        </td>
                      </tr>
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                        No product sales recorded in the selected date range.
                      </td>
                    </tr>
                  )}
                </tbody>
                {data.productProfitability && data.productProfitability.length > 0 && (
                  <tfoot className="bg-slate-50/80 dark:bg-[#142119] font-bold border-t border-slate-200 dark:border-[#2d4a35]">
                    <tr>
                      <td className="px-5 py-3.5 text-slate-800 dark:text-[#e2f5e8]">Total Products</td>
                      <td className="px-5 py-3.5 text-right font-mono text-slate-700 dark:text-[#e2f5e8]">
                        {fmtQty(
                          data.productProfitability.reduce((s: number, p: any) => s + (p.quantitySold || 0), 0)
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-900 dark:text-[#e2f5e8]">
                        {fmt(data.summary.netSales + data.summary.discounts)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-amber-700 dark:text-amber-400">
                        {fmt(data.summary.cogs)}
                      </td>
                      <td
                        className={`px-5 py-3.5 text-right ${
                          data.summary.grossProfit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {fmt(data.summary.grossProfit)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-slate-800 dark:text-[#e2f5e8]">
                        {Number(data.summary.grossMargin || 0).toFixed(2)}%
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          {/* ── 4. SALES, COLLECTIONS & SUPPLIER PAYOUTS BREAKDOWN ── */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Sales Revenue Breakdown */}
            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-1">Sales Revenue Breakdown</h3>
              <p className="text-xs text-slate-400 dark:text-[#64916e] mb-4">
                Revenue recognized when sales transactions take place (by sale method)
              </p>

              <div className="space-y-3">
                <BreakdownRow label="Cash Sales" value={fmt(data.salesBreakdown.cashSales)} />
                <BreakdownRow label="Online Sales" value={fmt(data.salesBreakdown.onlineSales)} />
                <BreakdownRow label="Split Sales" value={fmt(data.salesBreakdown.splitSales)} />
                <BreakdownRow label="Khata / Credit Sales" value={fmt(data.salesBreakdown.khataSales)} />
                {data.salesBreakdown.otherSales > 0 && (
                  <BreakdownRow label="Other Sales" value={fmt(data.salesBreakdown.otherSales)} />
                )}
                <div className="pt-2 border-t border-slate-200 dark:border-[#2d4a35]">
                  <BreakdownRow
                    label="Total Net Sales"
                    value={fmt(data.summary.netSales)}
                    emphasized
                    valueClass="text-slate-900 dark:text-[#e2f5e8] font-bold"
                  />
                </div>
              </div>
            </div>

            {/* Money Actually Collected */}
            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-1">Actual Amount Collected</h3>
              <p className="text-xs text-slate-400 dark:text-[#64916e] mb-4">
                Actual money received during this period (including Khata settlement collections)
              </p>

              <div className="space-y-3">
                <BreakdownRow
                  label="Cash Collected"
                  value={fmt(data.collectionsBreakdown.cashCollected)}
                  valueClass="text-blue-600 dark:text-blue-400"
                />
                <BreakdownRow
                  label="Online Collected"
                  value={fmt(data.collectionsBreakdown.onlineCollected)}
                  valueClass="text-blue-600 dark:text-blue-400"
                />
                <BreakdownRow
                  label="Khata Recoveries / Payments"
                  value={fmt(data.collectionsBreakdown.khataReceived)}
                  valueClass="text-indigo-600 dark:text-indigo-400"
                />
                {data.collectionsBreakdown.otherCollected > 0 && (
                  <BreakdownRow
                    label="Other Collections"
                    value={fmt(data.collectionsBreakdown.otherCollected)}
                  />
                )}
                <div className="pt-2 border-t border-slate-200 dark:border-[#2d4a35]">
                  <BreakdownRow
                    label="Total Amount Collected"
                    value={fmt(data.summary.amountCollected)}
                    emphasized
                    valueClass="text-blue-700 dark:text-blue-400 font-extrabold text-base"
                  />
                </div>
              </div>
            </div>

            {/* Supplier Cleared Payments */}
            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-1">Supplier Payments Cleared</h3>
              <p className="text-xs text-slate-400 dark:text-[#64916e] mb-4">
                Total money paid out to suppliers to clear dues in the selected period
              </p>

              <div className="space-y-3">
                <BreakdownRow
                  label="Cash Paid to Suppliers"
                  value={fmt(data.summary.supplierCashPaid)}
                  valueClass="text-amber-700 dark:text-amber-400"
                />
                <BreakdownRow
                  label="Online Paid to Suppliers"
                  value={fmt(data.summary.supplierOnlinePaid)}
                  valueClass="text-amber-700 dark:text-amber-400"
                />
                <BreakdownRow
                  label="Total Payment Transactions"
                  value={String(data.summary.supplierPaymentsCount || 0)}
                  valueClass="text-slate-700 dark:text-[#a7c4ae] font-mono"
                />
                <div className="pt-2 border-t border-slate-200 dark:border-[#2d4a35]">
                  <BreakdownRow
                    label="Total Paid to Suppliers"
                    value={fmt(data.summary.totalSupplierPaid)}
                    emphasized
                    valueClass="text-amber-700 dark:text-amber-400 font-extrabold text-base"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── 5. EXPENSE BREAKDOWN (CATEGORY -> SUBCATEGORY -> AMOUNT) ── */}
          <section className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-[#2d4a35] flex justify-between items-center flex-wrap gap-2">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Operating Expenses Breakdown</h3>
                <p className="text-xs text-slate-400 dark:text-[#64916e] mt-0.5">
                  Expenses grouped hierarchically by Expense Category → Expense Subcategory
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 dark:text-[#64916e]">Total Expenses:</span>
                <span className="ml-2 text-base font-extrabold text-rose-600 dark:text-rose-400">
                  {fmt(data.summary.totalExpenses)}
                </span>
              </div>
            </div>

            <div className="p-5">
              {data.expensesSummary?.categories && data.expensesSummary.categories.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {data.expensesSummary.categories.map((cat: any) => (
                    <div
                      key={cat.category}
                      className="bg-slate-50/70 dark:bg-[#142119] rounded-xl border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex justify-between items-center border-b border-slate-200/80 dark:border-[#2d4a35] pb-2 mb-2.5">
                          <span className="font-bold text-slate-800 dark:text-[#e2f5e8] text-sm">
                            {cat.category}
                          </span>
                          <span className="font-extrabold text-rose-600 dark:text-rose-400 text-sm">
                            {fmt(cat.total)}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {cat.subcategories && cat.subcategories.map((sub: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-xs text-slate-600 dark:text-[#a7c4ae]">
                              <span className="truncate pr-2">• {sub.subcategory}</span>
                              <span className="font-medium">{fmt(sub.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-slate-200/50 dark:border-[#2d4a35] text-[10px] text-slate-400 text-right">
                        {data.summary.totalExpenses > 0
                          ? ((Number(cat.total || 0) / Number(data.summary.totalExpenses || 1)) * 100).toFixed(1)
                          : 0}
                        % of total expenses
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-sm">
                  No expenses recorded in the selected period.
                </div>
              )}
            </div>
          </section>

          {/* ── 6. RETURNS & DISCOUNTS AUDIT SECTION ── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Returns & COGS Reversal Detail */}
            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Returns &amp; COGS Reversal</h3>
                <span className="text-xs font-semibold px-2 py-0.5 bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded">
                  {data.summary.numberOfReturns} Returns
                </span>
              </div>
              <div className="space-y-2.5 text-sm">
                <BreakdownRow label="Total Return Amount" value={fmt(data.summary.returns)} />
                <BreakdownRow
                  label="COGS Reversed into Inventory"
                  value={fmt(data.returnsSummary?.totalCogsReversed)}
                  valueClass="text-emerald-600 dark:text-emerald-400 font-semibold"
                />
                <BreakdownRow
                  label="Number of Return Transactions"
                  value={String(data.summary.numberOfReturns)}
                />
              </div>

              {data.returnsSummary?.list && data.returnsSummary.list.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#2d4a35] max-h-48 overflow-y-auto space-y-2">
                  {data.returnsSummary.list.map((r: any) => (
                    <div
                      key={r.id}
                      className="p-2 bg-slate-50 dark:bg-[#142119] rounded-lg text-xs flex justify-between items-center"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-[#e2f5e8]">{r.id}</span>
                        <span className="text-slate-400 ml-2">Bill #{r.billNumber}</span>
                        <span className="text-slate-500 ml-2">({r.customer})</span>
                      </div>
                      <div className="text-right font-semibold text-rose-600 dark:text-rose-400">
                        {fmt(r.refundAmount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discounts Detail */}
            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Discounts Reconciliation</h3>
                <span className="text-xs font-semibold px-2 py-0.5 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded">
                  {data.discountsSummary?.discountedSalesCount || 0} Discounted Bills
                </span>
              </div>
              <div className="space-y-2.5 text-sm">
                <BreakdownRow
                  label="POS Bill-Level & Item Discounts"
                  value={fmt(data.discountsSummary?.posDiscounts)}
                />
                <BreakdownRow
                  label="Khata / Settlement Write-Offs"
                  value={fmt(data.discountsSummary?.khataDiscounts)}
                />
                <div className="pt-2 border-t border-slate-200 dark:border-[#2d4a35]">
                  <BreakdownRow
                    label="Total Applied Discounts"
                    value={fmt(data.summary.discounts)}
                    emphasized
                    valueClass="text-amber-700 dark:text-amber-400 font-bold"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── 7. FINANCIAL RECONCILIATION & AUDIT VALIDATION ── */}
          <section className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">
                Accounting Reconciliation &amp; Mathematical Integrity
              </h3>
            </div>
            <p className="text-xs text-slate-400 dark:text-[#64916e] mb-4">
              Real-time validation ensuring every financial equation strictly balances to 0 variance
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Equation 1 */}
              <div className="bg-slate-50 dark:bg-[#142119] p-4 rounded-xl border border-slate-200 dark:border-[#2d4a35]">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Equation 1: Net Sales</div>
                <div className="text-xs text-slate-700 dark:text-[#a7c4ae] mt-1 font-mono">
                  Gross ({fmt(data.summary.grossSales)}) − Disc ({fmt(data.summary.discounts)}) − Ret ({fmt(data.summary.returns)})
                </div>
                <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-[#e2f5e8]">
                  = {fmt(data.reconciliation.grossSalesMinusDiscountsAndReturns)}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled with Net Sales
                </div>
              </div>

              {/* Equation 2 */}
              <div className="bg-slate-50 dark:bg-[#142119] p-4 rounded-xl border border-slate-200 dark:border-[#2d4a35]">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Equation 2: Gross Profit</div>
                <div className="text-xs text-slate-700 dark:text-[#a7c4ae] mt-1 font-mono">
                  Net Sales ({fmt(data.summary.netSales)}) − COGS ({fmt(data.summary.cogs)})
                </div>
                <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-[#e2f5e8]">
                  = {fmt(data.reconciliation.netSalesMinusCogs)}
                </div>
                <div className="mt-1 flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled with Gross Profit
                </div>
              </div>

              {/* Equation 3 */}
              <div className="bg-slate-50 dark:bg-[#142119] p-4 rounded-xl border border-slate-200 dark:border-[#2d4a35]">
                <div className="text-[11px] font-bold text-slate-500 uppercase">Equation 3: Net Profit</div>
                <div className="text-xs text-slate-700 dark:text-[#a7c4ae] mt-1 font-mono">
                  Gross Profit ({fmt(data.summary.grossProfit)}) − Expenses ({fmt(data.summary.totalExpenses)})
                </div>
                <div className="mt-2 text-sm font-extrabold text-slate-900 dark:text-[#e2f5e8]">
                  = {fmt(data.reconciliation.grossProfitMinusExpenses)}
                </div>
                <div className="mt-1 flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Reconciled with Net Profit
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {!isLoading && !error && !data && <EmptyState onRefresh={loadReport} />}
    </ReportLayout>
    </ReportErrorBoundary>
  );
};

// ─── Reusable Helper Components ─────────────────────────────────────────────
const BreakdownRow: React.FC<{
  label: string;
  value: string;
  emphasized?: boolean;
  valueClass?: string;
}> = ({ label, value, emphasized = false, valueClass = 'text-slate-800 dark:text-[#e2f5e8]' }) => (
  <div className="flex justify-between items-center text-sm">
    <span className={emphasized ? 'font-bold text-slate-800 dark:text-[#e2f5e8]' : 'text-slate-600 dark:text-[#a7c4ae]'}>
      {label}
    </span>
    <span className={valueClass}>{value}</span>
  </div>
);
