import React, { useState, useEffect } from 'react';
import { DateFilterType } from '../../types';
import { getSupplierReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { Users, ShoppingCart, Banknote, AlertCircle, Percent, TrendingDown } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import { Pagination } from '../../components/common/Pagination';
import { useChartTheme } from '../../hooks/useChartTheme';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export const SupplierReport: React.FC = () => {
  const { grid, axis, tooltipStyle, tooltipLabelStyle } = useChartTheme();
  const [filter, setFilter] = useState<DateFilterType>({
    label: 'All Time',
    startDate: null,
    endDate: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter.label, filter.startDate?.toISOString(), searchTerm]);

  const loadReport = async () => {
    setIsLoading(true); setError(null);
    try {
      const result = await getSupplierReport(filter);
      setData(result);
    } catch (e) {
      setError('Failed to load Supplier report.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [filter.label, filter.startDate?.toISOString()]);

  const fmt = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

  const filtered = (data?.suppliers || []).filter((s: any) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.phone.includes(searchTerm)
  );

  return (
    <ReportLayout>
      <ReportHeader
        title="Supplier Report"
        description="Overview of supplier purchases, payments, and outstanding balances."
        exportData={filtered}
        exportColumns={[
          { header: 'Supplier', dataKey: 'name' }, { header: 'Phone', dataKey: 'phone' },
          { header: 'Total Purchases', dataKey: 'totalPurchases' }, { header: 'Paid', dataKey: 'paid' },
          { header: 'Returns', dataKey: 'returns' }, { header: 'Incentives', dataKey: 'incentives' },
          { header: 'Outstanding', dataKey: 'outstanding' }, { header: 'Status', dataKey: 'status' }
        ]}
        exportSummary={data?.summary ? {
          totalSuppliers: data.summary.totalSuppliers,
          totalPurchases: fmt(data.summary.totalPurchases),
          totalPaid: fmt(data.summary.totalPaid),
          totalPayable: fmt(data.summary.totalPayable),
          totalReturns: fmt(data.summary.totalReturns),
          incentives: fmt(data.summary.totalIncentives),
        } : undefined}
      />
      <ReportFilters currentFilter={filter} onFilterChange={setFilter} onRefresh={loadReport} searchTerm={searchTerm} onSearchChange={setSearchTerm} isLoading={isLoading} />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard title="Total Suppliers" value={data.summary.totalSuppliers} icon={Users} />
            <SummaryCard title="Total Purchases" value={fmt(data.summary.totalPurchases)} icon={ShoppingCart} valueColor="text-blue-600 dark:text-blue-400" />
            <SummaryCard title="Total Paid" value={fmt(data.summary.totalPaid)} icon={Banknote} valueColor="text-emerald-600 dark:text-emerald-400" />
            <SummaryCard title="Total Payable" value={fmt(data.summary.totalPayable)} icon={AlertCircle} valueColor="text-rose-600 dark:text-rose-400" />
            <SummaryCard title="Total Returns" value={fmt(data.summary.totalReturns)} icon={TrendingDown} />
            <SummaryCard title="Incentives" value={fmt(data.summary.totalIncentives)} icon={Percent} valueColor="text-amber-600 dark:text-amber-400" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[300px] flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-2">Purchases by Supplier</h3>
              {(() => {
                const chartData = (data.purchasesBySupplier || []).filter((item: any) => (item.value || 0) > 0);
                if (chartData.length === 0) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">
                      No purchase data available for this period
                    </div>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="45%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="label"
                      >
                        {chartData.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip formatter={(v: any) => `Rs. ${Number(v || 0).toLocaleString()}`} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>

            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[300px] flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-2">Outstanding Balances</h3>
              {(() => {
                const chartData = (data.outstandingBySupplier || []).filter((item: any) => (item.value || 0) > 0);
                if (chartData.length === 0) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">
                      No outstanding balances for this period
                    </div>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={grid} />
                      <XAxis type="number" stroke={axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `Rs.${v/1000}k`} />
                      <YAxis type="category" dataKey="label" stroke={axis} fontSize={11} tickLine={false} axisLine={false} width={100} />
                      <RechartsTooltip formatter={(v: any) => `Rs. ${Number(v || 0).toLocaleString()}`} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                      <Bar dataKey="value" name="Outstanding" fill="#EF4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Supplier Directory & Balances</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0">
                  <tr>
                    {['Supplier Name', 'Phone', 'Total Purchases', 'Paid Amount', 'Returns', 'Incentives', 'Outstanding', 'Last Activity', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 dark:text-[#64916e] text-sm">No suppliers found.</td></tr>
                  )}
                  {filtered
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-[#e2f5e8]">{s.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">{s.phone}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-[#a7c4ae]">{fmt(s.totalPurchases)}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium">{fmt(s.paid)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#8ba895]">{fmt(s.returns)}</td>
                      <td className="px-4 py-3 text-sm text-amber-500 dark:text-amber-400">{fmt(s.incentives)}</td>
                      <td className={`px-4 py-3 text-sm font-bold ${s.outstanding > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {fmt(s.outstanding)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#8ba895]">
                        {new Date(s.lastTransaction).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.status === 'Cleared' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'}`}>
                          {s.status}
                        </span>
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
                itemLabel="suppliers"
              />
            )}
          </div>
        </>
      )}
      {!isLoading && !error && !data && <EmptyState onRefresh={loadReport} />}
    </ReportLayout>
  );
};
