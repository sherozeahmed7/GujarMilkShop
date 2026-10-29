import React, { useState, useEffect } from 'react';
import { DateFilterType } from '../../types';
import { getCashRegisterReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { Banknote, ArrowUpCircle, ArrowDownCircle, TrendingUp, AlertCircle, CheckCircle, Wallet } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { Pagination } from '../../components/common/Pagination';
import { useChartTheme } from '../../hooks/useChartTheme';

export const CashRegisterReport: React.FC = () => {
  const { grid, axis, tooltipStyle, tooltipLabelStyle } = useChartTheme();
  const [filter, setFilter] = useState<DateFilterType>({
    label: 'This Month',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter.label, filter.startDate?.toISOString(), filter.endDate?.toISOString(), searchTerm]);

  const loadReport = async () => {
    setIsLoading(true); setError(null);
    try {
      const result = await getCashRegisterReport(filter);
      setData(result);
    } catch (e) {
      setError('Failed to load Cash Register report.'); console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [filter.label, filter.startDate?.toISOString(), filter.endDate?.toISOString()]);

  const fmt = (n: number) => {
    if (isNaN(n) || !isFinite(n)) return 'Rs. 0';
    return `Rs. ${Math.round(n).toLocaleString()}`;
  };

  const filtered = (data?.history || []).filter((r: any) =>
    r.cashier.toLowerCase().includes(searchTerm.toLowerCase()) || r.id.includes(searchTerm)
  );

  return (
    <ReportLayout>
      <ReportHeader
        title="Cash Register Report"
        description="Cash flow derived from actual sales, expenses, and returns data."
        exportData={filtered}
        exportColumns={[
          { header: 'Date', dataKey: 'date' }, { header: 'Cashier', dataKey: 'cashier' },
          { header: 'Opening', dataKey: 'openingCash' }, { header: 'Cash Sales', dataKey: 'cashSales' },
          { header: 'Cash In', dataKey: 'cashIn' }, { header: 'Cash Out', dataKey: 'cashOut' },
          { header: 'Expenses', dataKey: 'expenses' }, { header: 'Refunds', dataKey: 'refunds' },
          { header: 'Expected', dataKey: 'expectedCash' }, { header: 'Actual', dataKey: 'countedCash' },
          { header: 'Variance', dataKey: 'variance' }, { header: 'Status', dataKey: 'status' }
        ]}
        exportSummary={data?.summary ? {
          openingCash: fmt(data.summary.openingCash),
          cashSales: fmt(data.summary.cashSales),
          expenses: fmt(data.summary.expenses),
          expectedCash: fmt(data.summary.expectedCash),
          countedCash: fmt(data.summary.countedCash),
          closingCash: fmt(data.summary.closingCash),
          variance: fmt(data.summary.variance),
        } : undefined}
      />
      <ReportFilters currentFilter={filter} onFilterChange={setFilter} onRefresh={loadReport} searchTerm={searchTerm} onSearchChange={setSearchTerm} isLoading={isLoading} />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <SummaryCard title="Opening Cash" value={fmt(data.summary.openingCash)} icon={Banknote} />
            <SummaryCard title="Cash Sales" value={fmt(data.summary.cashSales)} icon={TrendingUp} valueColor="text-emerald-600 dark:text-emerald-400" />
            <SummaryCard title="Cash In" value={fmt(data.summary.cashIn)} icon={ArrowUpCircle} valueColor="text-blue-600 dark:text-blue-400" />
            <SummaryCard title="Cash Out" value={fmt(data.summary.cashOut)} icon={ArrowDownCircle} valueColor="text-amber-600 dark:text-amber-400" />
            <SummaryCard title="Expenses (Cash)" value={fmt(data.summary.expenses)} icon={Wallet} valueColor="text-rose-600 dark:text-rose-400" />
            <SummaryCard title="Refunds (Cash)" value={fmt(data.summary.refunds)} icon={ArrowDownCircle} valueColor="text-rose-500 dark:text-rose-400" />
            <SummaryCard title="Expected Cash" value={fmt(data.summary.expectedCash)} icon={CheckCircle} />
            <SummaryCard title="Counted Cash" value={fmt(data.summary.countedCash)} icon={Banknote} valueColor="text-blue-600 dark:text-blue-400" />
            <SummaryCard title="Net Variance" value={fmt(data.summary.variance)} icon={AlertCircle} valueColor={data.summary.variance < -500 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'} />
            <SummaryCard title="Closing Cash" value={fmt(data.summary.closingCash)} icon={Banknote} valueColor="text-blue-600 dark:text-blue-400" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-4">Daily Cash Movement</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.movementData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                  <XAxis dataKey="label" stroke={axis} fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke={axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                  <Legend />
                  <Bar dataKey="cashIn" name="Cash In (Total)" fill="#10B981" radius={[4,4,0,0]} />
                  <Bar dataKey="cashOut" name="Cash Out (Total)" fill="#F59E0B" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-4">Expected vs Actual Cash</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.movementData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                  <XAxis dataKey="label" stroke={axis} fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke={axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                  <Legend />
                  <Line type="monotone" dataKey="expected" name="Expected" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="actual" name="Actual" stroke="#10B981" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2d4a35]">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Register History</h3>
              <p className="text-xs text-slate-400 dark:text-[#64916e] mt-0.5">Calculations integrated from actual sales, expenses, and returns</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0">
                  <tr>
                    {['Date', 'Cashier', 'Opening', 'Cash Sales', 'Cash In', 'Cash Out', 'Expenses', 'Refunds', 'Expected', 'Actual', 'Variance', 'Status'].map(h => (
                      <th key={h} className="px-3 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {filtered.length === 0 && (
                    <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-400 dark:text-[#64916e] text-sm">No records for the selected period.</td></tr>
                  )}
                  {filtered
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                      <td className="px-3 py-3 text-sm text-slate-700 dark:text-[#e2f5e8]">{r.date}</td>
                      <td className="px-3 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">{r.cashier}</td>
                      <td className="px-3 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">{fmt(r.openingCash)}</td>
                      <td className="px-3 py-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium">{fmt(r.cashSales)}</td>
                      <td className="px-3 py-3 text-sm text-blue-600 dark:text-blue-400">{fmt(r.cashIn)}</td>
                      <td className="px-3 py-3 text-sm text-amber-600 dark:text-amber-400">{fmt(r.cashOut)}</td>
                      <td className="px-3 py-3 text-sm text-rose-500 dark:text-rose-400">{fmt(r.expenses)}</td>
                      <td className="px-3 py-3 text-sm text-rose-500 dark:text-rose-400">{fmt(r.refunds)}</td>
                      <td className="px-3 py-3 text-sm font-medium text-slate-700 dark:text-[#e2f5e8]">{fmt(r.expectedCash)}</td>
                      <td className="px-3 py-3 text-sm font-medium text-slate-700 dark:text-[#e2f5e8]">{fmt(r.countedCash)}</td>
                      <td className={`px-3 py-3 text-sm font-semibold ${r.variance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {r.variance > 0 ? '+' : ''}Rs. {r.variance.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.status === 'Balanced' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400'}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filtered.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                itemLabel="records"
              />
            )}
          </div>
        </>
      )}

      {!isLoading && !error && !data && <EmptyState onRefresh={loadReport} />}
    </ReportLayout>
  );
};
