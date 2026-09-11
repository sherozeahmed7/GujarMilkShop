import React, { useState, useEffect } from 'react';
import { DateFilterType } from '../../types';
import { getProfitAndLossReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { TrendingUp, TrendingDown, DollarSign, BarChart2, Percent } from 'lucide-react';

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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <SummaryCard title="Net Sales" value={fmt(data.revenue.netSales)} icon={TrendingUp} valueColor="text-blue-600" />
            <SummaryCard title="Total COGS" value={fmt(data.costs.totalCosts)} icon={BarChart2} valueColor="text-amber-600" />
            <SummaryCard title="Gross Profit" value={fmt(data.profit.grossProfit)} icon={DollarSign} valueColor="text-emerald-600" />
            <SummaryCard title="Net Profit" value={fmt(data.profit.netProfit)} icon={data.profit.netProfit >= 0 ? TrendingUp : TrendingDown} valueColor={data.profit.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
            <SummaryCard title="Profit Margin" value={`${data.profit.margin}%`} icon={Percent} valueColor={data.profit.margin >= 0 ? 'text-emerald-600' : 'text-rose-600'} />
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="font-bold text-slate-800">Profit & Loss Statement</h3>
                <p className="text-xs text-slate-400 mt-0.5">Actual synced sales, returns, costs, and expenses for the selected range</p>
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
