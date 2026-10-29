import React, { useState, useEffect } from 'react';
import { DateFilterType } from '../../types';
import { getShiftsReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { Clock, CheckCircle, XCircle, Timer, Banknote, AlertCircle, Users } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts';
import { Pagination } from '../../components/common/Pagination';
import { useChartTheme } from '../../hooks/useChartTheme';
import { formatUserName } from '../../utils/userFormat';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

export const ShiftsReport: React.FC = () => {
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
    try { setData(await getShiftsReport(filter)); }
    catch (e) { setError('Failed to load Shifts report.'); console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadReport(); }, [filter.label, filter.startDate?.toISOString(), filter.endDate?.toISOString()]);

  const fmt = (n: number) => {
    if (isNaN(n) || !isFinite(n)) return 'Rs. 0';
    return `Rs. ${Math.round(n).toLocaleString()}`;
  };

  const filtered = (data?.shifts || []).filter((s: any) =>
    s.openedBy.toLowerCase().includes(searchTerm.toLowerCase()) || s.id.includes(searchTerm)
  );

  return (
    <ReportLayout>
      <ReportHeader
        title="Shifts Report"
        description="Cashier shift analysis with sales performance and cash variance."
        exportData={filtered}
        exportColumns={[
          { header: 'Shift ID', dataKey: 'id' }, { header: 'Date', dataKey: 'date' },
          { header: 'Opened By', dataKey: 'openedBy' }, { header: 'Open Time', dataKey: 'openTime' },
          { header: 'Closed By', dataKey: 'closedBy' }, { header: 'Close Time', dataKey: 'closeTime' },
          { header: 'Opening Cash', dataKey: 'openingCash' }, { header: 'Cash Sales', dataKey: 'cashSales' },
          { header: 'Expected', dataKey: 'expectedCash' }, { header: 'Counted', dataKey: 'countedCash' },
          { header: 'Variance', dataKey: 'variance' }, { header: 'Status', dataKey: 'status' },
        ]}
        exportSummary={data?.summary ? {
          totalShifts: data.summary.totalShifts,
          openShifts: data.summary.openShifts,
          closedShifts: data.summary.closedShifts,
          totalHours: `${data.summary.totalHours}h`,
          expectedCash: fmt(data.summary.expectedCash),
          countedCash: fmt(data.summary.countedCash),
          totalVariance: fmt(data.summary.totalVariance),
        } : undefined}
      />
      <ReportFilters currentFilter={filter} onFilterChange={setFilter} onRefresh={loadReport} searchTerm={searchTerm} onSearchChange={setSearchTerm} isLoading={isLoading} />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <SummaryCard title="Total Shifts" value={data.summary.totalShifts} icon={Clock} />
            <SummaryCard title="Open Shifts" value={data.summary.openShifts} icon={Clock} valueColor="text-amber-600 dark:text-amber-400" />
            <SummaryCard title="Closed Shifts" value={data.summary.closedShifts} icon={CheckCircle} valueColor="text-emerald-600 dark:text-emerald-400" />
            <SummaryCard title="Total Hours" value={`${data.summary.totalHours}h`} icon={Timer} valueColor="text-blue-600 dark:text-blue-400" />
            <SummaryCard title="Opening Cash" value={fmt(data.summary.openingCash)} icon={Banknote} />
            <SummaryCard title="Expected Cash" value={fmt(data.summary.expectedCash)} icon={Banknote} valueColor="text-blue-600 dark:text-blue-400" />
            <SummaryCard title="Counted Cash" value={fmt(data.summary.countedCash)} icon={Banknote} valueColor="text-emerald-600 dark:text-emerald-400" />
            <SummaryCard title="Total Variance" value={fmt(data.summary.totalVariance)} icon={AlertCircle} valueColor="text-rose-600 dark:text-rose-400" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-4">Cash Sales by Shift</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.salesByShift}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                  <XAxis dataKey="label" stroke={axis} fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke={axis} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                  <Bar dataKey="value" name="Cash Sales" radius={[4,4,0,0]}>
                    {data.salesByShift.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-4">Sales by Cashier</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.byCashier} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={grid} />
                  <XAxis type="number" stroke={axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `${v/1000}k`} />
                  <YAxis type="category" dataKey="label" stroke={axis} fontSize={11} tickLine={false} axisLine={false} width={80} />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                  <Bar dataKey="value" name="Cash Sales" fill="#8B5CF6" radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="xl:col-span-3 bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[280px]">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-4">Cash Variance by Shift</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.varianceByShift}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                  <XAxis dataKey="label" stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                  <Bar dataKey="value" name="Variance" fill="#F59E0B" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2d4a35]"><h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Shift History</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0">
                  <tr>
                    {['Shift', 'Date', 'Opened By', 'Open Time', 'Closed By', 'Close Time', 'Opening', 'Cash Sales', 'Expected', 'Counted', 'Variance', 'Status'].map(h => (
                      <th key={h} className="px-3 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {filtered.length === 0 && <tr><td colSpan={12} className="py-10 text-center text-slate-400 dark:text-[#64916e] text-sm">No shifts found for the selected period.</td></tr>}
                  {filtered
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                      <td className="px-3 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">{s.id}</td>
                      <td className="px-3 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">{s.date}</td>
                      <td className="px-3 py-3 text-sm text-slate-700 dark:text-[#e2f5e8]">{formatUserName(s.openedBy)}</td>
                      <td className="px-3 py-3 text-sm text-slate-500 dark:text-[#8ba895]">{new Date(s.openTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3 py-3 text-sm text-slate-700 dark:text-[#e2f5e8]">{formatUserName(s.closedBy)}</td>
                      <td className="px-3 py-3 text-sm text-slate-500 dark:text-[#8ba895]">{new Date(s.closeTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-3 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">{fmt(s.openingCash)}</td>
                      <td className="px-3 py-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium">{fmt(s.cashSales)}</td>
                      <td className="px-3 py-3 text-sm text-slate-700 dark:text-[#e2f5e8]">{fmt(s.expectedCash)}</td>
                      <td className="px-3 py-3 text-sm text-slate-700 dark:text-[#e2f5e8]">{fmt(s.countedCash)}</td>
                      <td className={`px-3 py-3 text-sm font-semibold ${s.variance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{s.variance > 0 ? '+' : ''}Rs. {s.variance.toLocaleString()}</td>
                      <td className="px-3 py-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">{s.status}</span></td>
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
                itemLabel="shifts"
              />
            )}
          </div>
        </>
      )}

      {!isLoading && !error && !data && <EmptyState onRefresh={loadReport} />}
    </ReportLayout>
  );
};
