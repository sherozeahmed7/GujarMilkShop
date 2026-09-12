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
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer,
  Tooltip as RechartsTooltip, XAxis, YAxis,
} from 'recharts';

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
          TotalSales: fmt(data.summary.totalSales),
          ReturnAmount: fmt(data.summary.returnAmount),
          Expenses: fmt(data.summary.expenses),
          NumberOfSales: data.summary.numberOfSales,
          NetProfit: fmt(data.profit.netProfit),
        } : undefined}
      />

      <ReportFilters currentFilter={filter} onFilterChange={setFilter} onRefresh={loadReport} isLoading={isLoading} />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <SummaryCard title="Total Sales" value={fmt(data.summary.totalSales)} icon={TrendingUp} valueColor="text-blue-600" />
            <SummaryCard title="Return Amount" value={fmt(data.summary.returnAmount)} icon={TrendingDown} valueColor="text-rose-600" />
            <SummaryCard title="Expenses" value={fmt(data.summary.expenses)} icon={BarChart2} valueColor="text-amber-600" />
            <SummaryCard title="Number of Sales" value={data.summary.numberOfSales} icon={DollarSign} valueColor="text-slate-700" />
            <SummaryCard title="Net Profit" value={fmt(data.profit.netProfit)} icon={data.profit.netProfit >= 0 ? TrendingUp : TrendingDown} valueColor={data.profit.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="font-bold text-slate-800">Daily Sales</h3>
              <p className="text-xs text-slate-400 mt-1">Recorded sales amount for each day in the selected range</p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.charts.revVsCost}>
                    <defs>
                      <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563EB" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(value: number) => `Rs.${value}`} />
                    <RechartsTooltip formatter={(value) => fmt(Number(value ?? 0))} />
                    <Area type="monotone" dataKey="revenue" name="Sales" stroke="#2563EB" fill="url(#salesFill)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
              <h3 className="font-bold text-slate-800">Revenue vs Cost</h3>
              <p className="text-xs text-slate-400 mt-1">Daily recorded revenue compared with product cost and wastage</p>
              <div className="h-64 mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.charts.revVsCost}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(value: number) => `Rs.${value}`} />
                    <RechartsTooltip formatter={(value) => fmt(Number(value ?? 0))} />
                    <Legend />
                    <Bar dataKey="revenue" name="Revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cost" name="Cost + Wastage" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">Profit & Loss Statement</h3>
              <p className="text-xs text-slate-400 mt-0.5">Actual synced sales, returns, costs, and expenses for the selected range</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-5 py-3 font-bold">Category</th>
                    <th className="px-5 py-3 font-bold">Title</th>
                    <th className="px-5 py-3 text-right font-bold whitespace-nowrap">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <TableRow section="Sales" label="Total Sales" value={fmt(data.revenue.grossSales)} />
                  <TableRow section="Sales" label="Discounts" value={`(${fmt(data.revenue.discounts)})`} valueClass="text-rose-500" />
                  <TableRow section="Sales" label="Return Amount" value={`(${fmt(data.revenue.returns)})`} valueClass="text-rose-500" />
                  <TableRow section="Sales" label="Number of Returns" value={String(data.summary.numberOfReturns)} />
                  <TableRow section="Collections" label="Amount Collected" value={fmt(data.summary.amountCollected)} emphasized valueClass="text-blue-600" />
                  <TableRow section="Sales" label="Number of Sales" value={String(data.summary.numberOfSales)} />
                  <TableRow section="Sales" label="Net Sales" value={fmt(data.revenue.netSales)} emphasized />
                  <TableRow section="Costs" label="Product Cost" value={fmt(data.costs.cogs)} />
                  <TableRow
                    section="Costs"
                    label="Gross Profit"
                    value={fmt(data.profit.grossProfit)}
                    emphasized
                    valueClass={data.profit.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}
                  />
                  {Object.entries(data.expenses.breakdown).map(([category, amount]) => (
                    <TableRow key={category} section="Expenses" label={category} value={fmt(amount as number)} />
                  ))}
                  <TableRow section="Expenses" label="Total Expenses" value={`(${fmt(data.expenses.totalExpenses)})`} emphasized valueClass="text-rose-500" />
                  <TableRow
                    section="Result"
                    label="Net Profit / (Loss)"
                    value={fmt(data.profit.netProfit)}
                    emphasized
                    valueClass={isBreakEven ? 'text-slate-700' : isProfit ? 'text-emerald-600' : 'text-rose-600'}
                  />
                  <TableRow section="Result" label="Profit Margin" value={`${data.profit.margin}%`} />
                </tbody>
              </table>
            </div>
              </div>
        </>
      )}

      {!isLoading && !error && !data && <EmptyState onRefresh={loadReport} />}
    </ReportLayout>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const TableRow: React.FC<{
  section: string;
  label: string;
  value: string;
  emphasized?: boolean;
  valueClass?: string;
}> = ({ section, label, value, emphasized = false, valueClass = 'text-slate-700' }) => (
  <tr className={emphasized ? 'bg-slate-50/70' : undefined}>
    <td className="px-5 py-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-400">{section}</td>
    <td className={`px-5 py-3 whitespace-nowrap ${emphasized ? 'font-semibold text-slate-800' : 'text-slate-600'}`}>{label}</td>
    <td className={`px-5 py-3 text-right whitespace-nowrap ${emphasized ? 'font-bold' : 'font-medium'} ${valueClass}`}>{value}</td>
  </tr>
);
