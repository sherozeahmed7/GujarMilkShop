import React, { useState, useEffect } from 'react';
import { DateFilterType } from '../../types';
import { getProfitAndLossReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Percent } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export const ProfitLossReport: React.FC = () => {
  const [filter, setFilter] = useState<DateFilterType>({
    label: 'This Month',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59),
  });

  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getProfitAndLossReport(filter);
      setData(result);
    } catch (e) {
      setError('Failed to load Profit & Loss report.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [filter.label, filter.startDate?.toISOString(), filter.endDate?.toISOString()]);

  const fmt = (n: number) => {
    if (isNaN(n) || !isFinite(n)) return 'Rs. 0';
    return `Rs. ${Math.round(n).toLocaleString()}`;
  };

  const isProfit = data && data.profit.netProfit > 0;
  const isBreakEven = data && Math.abs(data.profit.netProfit) < 1000;

  const exportData = data ? [
    { item: 'Gross Sales', amount: data.revenue.grossSales },
    { item: 'Discounts', amount: -data.revenue.discounts },
    { item: 'Returns', amount: -data.revenue.returns },
    { item: 'Net Sales', amount: data.revenue.netSales },
    { item: 'Cost of Goods Sold', amount: -data.costs.cogs },
    { item: 'Wastage', amount: -data.costs.wastage },
    { item: 'Gross Profit', amount: data.profit.grossProfit },
    { item: 'Operating Expenses', amount: -data.expenses.operating },
    { item: 'Net Profit', amount: data.profit.netProfit },
    { item: 'Profit Margin %', amount: data.profit.margin },
  ] : [];

  return (
    <ReportLayout>
      <ReportHeader
        title="Profit & Loss Statement"
        description="Calculated from actual sales, returns, COGS, and expense data."
        exportData={exportData}
        exportColumns={[{ header: 'Item', dataKey: 'item' }, { header: 'Amount (Rs.)', dataKey: 'amount' }]}
        exportSummary={data ? {
          NetSales: fmt(data.revenue.netSales),
          GrossProfit: fmt(data.profit.grossProfit),
          NetProfit: fmt(data.profit.netProfit),
          ProfitMargin: `${data.profit.margin}%`,
        } : undefined}
      />

      <ReportFilters currentFilter={filter} onFilterChange={setFilter} onRefresh={loadReport} isLoading={isLoading} />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <SummaryCard title="Net Sales" value={fmt(data.revenue.netSales)} icon={TrendingUp} valueColor="text-blue-600" />
            <SummaryCard title="Total COGS" value={fmt(data.costs.totalCosts)} icon={BarChart2} valueColor="text-amber-600" />
            <SummaryCard title="Gross Profit" value={fmt(data.profit.grossProfit)} icon={DollarSign} valueColor="text-emerald-600" />
            <SummaryCard title="Net Profit" value={fmt(data.profit.netProfit)} icon={data.profit.netProfit >= 0 ? TrendingUp : TrendingDown} valueColor={data.profit.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
            <SummaryCard title="Profit Margin" value={`${data.profit.margin}%`} icon={Percent} valueColor={data.profit.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* P&L Statement Table */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Statement of Profit & Loss</h3>
                <p className="text-xs text-slate-400 mt-0.5">Based on actual transactions for the selected period</p>
              </div>
              <div className="p-5 space-y-5">
                {/* Revenue Section */}
                <section>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Revenue</h4>
                  <div className="space-y-2.5">
                    <Row label="Gross Sales" value={fmt(data.revenue.grossSales)} />
                    <Row label="Less: Discounts" value={`(${fmt(data.revenue.discounts)})`} color="text-rose-500" />
                    <Row label="Less: Returns" value={`(${fmt(data.revenue.returns)})`} color="text-rose-500" />
                    <DividerRow label="Net Sales" value={fmt(data.revenue.netSales)} />
                  </div>
                </section>

                {/* Cost Section */}
                <section>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Cost of Goods Sold</h4>
                  <div className="space-y-2.5">
                    <Row label="Purchase / Production Cost" value={fmt(data.costs.cogs)} />
                    <Row label="Wastage" value={fmt(data.costs.wastage)} />
                    <DividerRow label="Gross Profit" value={fmt(data.profit.grossProfit)} color={data.profit.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
                  </div>
                </section>

                {/* Expenses Section */}
                <section>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Operating Expenses</h4>
                  <div className="space-y-2.5">
                    {Object.entries(data.expenses.breakdown).map(([cat, amt]) => (
                      <Row key={cat} label={cat} value={fmt(amt as number)} />
                    ))}
                    <DividerRow label="Total Expenses" value={`(${fmt(data.expenses.totalExpenses)})`} color="text-rose-500" />
                  </div>
                </section>

                {/* Net Profit */}
                <div className={`p-4 rounded-xl flex items-center justify-between ${isBreakEven ? 'bg-slate-50 border border-slate-200' : isProfit ? 'bg-emerald-50 border border-emerald-200' : 'bg-rose-50 border border-rose-200'}`}>
                  <div>
                    <p className="font-bold text-slate-800 text-base">Net Profit / (Loss)</p>
                    <p className="text-xs text-slate-500 mt-0.5">Margin: {data.profit.margin}%</p>
                  </div>
                  <p className={`text-xl font-bold ${isBreakEven ? 'text-slate-700' : isProfit ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {fmt(data.profit.netProfit)}
                  </p>
                </div>
              </div>
            </div>

            {/* Charts Column */}
            <div className="flex flex-col gap-5">
              {/* Revenue vs Cost */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[280px]">
                <h3 className="font-bold text-slate-800 mb-4">Revenue vs Cost</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.charts.revVsCost}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                    <RechartsTooltip formatter={(v: number) => `Rs. ${v.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#3B82F6" radius={[4,4,0,0]} />
                    <Bar dataKey="cost" name="COGS" fill="#F59E0B" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Gross Profit Trend */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[280px]">
                <h3 className="font-bold text-slate-800 mb-4">Gross Profit Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data.charts.profitTrend}>
                    <defs>
                      <linearGradient id="plGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <RechartsTooltip formatter={(v: number) => `Rs. ${v.toLocaleString()}`} />
                    <Area type="monotone" dataKey="value" name="Gross Profit" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#plGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Expenses Breakdown Donut */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[280px]">
                <h3 className="font-bold text-slate-800 mb-4">Expenses Breakdown</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={data.charts.expBreakdown} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                      {data.charts.expBreakdown.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip formatter={(v: number) => `Rs. ${v.toLocaleString()}`} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Profit/Loss Visual Indicator */}
          <div className={`rounded-xl border p-8 flex flex-col sm:flex-row items-center justify-between gap-6 ${isBreakEven ? 'bg-slate-50 border-slate-200' : isProfit ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
            <div>
              <h3 className={`text-2xl font-bold ${isBreakEven ? 'text-slate-700' : isProfit ? 'text-emerald-700' : 'text-rose-700'}`}>
                {isBreakEven ? '⚖️ Break-even Period' : isProfit ? '📈 Profitable Period' : '📉 Operating at a Loss'}
              </h3>
              <p className="text-slate-600 mt-1">
                Net profit margin of <strong>{data.profit.margin}%</strong> on net sales of{' '}
                <strong>{fmt(data.revenue.netSales)}</strong> for the selected period.
              </p>
            </div>
            <div className="text-center shrink-0">
              <div className={`text-4xl font-bold ${isProfit ? 'text-emerald-600' : isBreakEven ? 'text-slate-700' : 'text-rose-600'}`}>
                {fmt(data.profit.netProfit)}
              </div>
              <p className="text-sm text-slate-500 mt-1">Net Profit / (Loss)</p>
            </div>
          </div>
        </>
      )}

      {!isLoading && !error && !data && <EmptyState onRefresh={loadReport} />}
    </ReportLayout>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const Row: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'text-slate-700' }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm text-slate-600">{label}</span>
    <span className={`text-sm font-medium ${color}`}>{value}</span>
  </div>
);

const DividerRow: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color = 'text-slate-800' }) => (
  <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-1">
    <span className="text-sm font-semibold text-slate-700">{label}</span>
    <span className={`text-sm font-bold ${color}`}>{value}</span>
  </div>
);
