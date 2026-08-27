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

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export const SupplierReport: React.FC = () => {
  const [filter, setFilter] = useState<DateFilterType>({
    label: 'All Time',
    startDate: null,
    endDate: null
  });
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
      />
      <ReportFilters currentFilter={filter} onFilterChange={setFilter} onRefresh={loadReport} searchTerm={searchTerm} onSearchChange={setSearchTerm} isLoading={isLoading} />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard title="Total Suppliers" value={data.summary.totalSuppliers} icon={Users} />
            <SummaryCard title="Total Purchases" value={fmt(data.summary.totalPurchases)} icon={ShoppingCart} valueColor="text-blue-600" />
            <SummaryCard title="Total Paid" value={fmt(data.summary.totalPaid)} icon={Banknote} valueColor="text-emerald-600" />
            <SummaryCard title="Total Payable" value={fmt(data.summary.totalPayable)} icon={AlertCircle} valueColor="text-rose-600" />
            <SummaryCard title="Total Returns" value={fmt(data.summary.totalReturns)} icon={TrendingDown} />
            <SummaryCard title="Incentives" value={fmt(data.summary.totalIncentives)} icon={Percent} valueColor="text-amber-600" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 mb-4">Purchases by Supplier</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data.purchasesBySupplier} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {data.purchasesBySupplier.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 mb-4">Outstanding Balances</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.outstandingBySupplier} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `Rs.${v/1000}k`} />
                  <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} />
                  <Bar dataKey="value" name="Outstanding" fill="#EF4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Supplier Directory & Balances</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {['Supplier Name', 'Phone', 'Total Purchases', 'Paid Amount', 'Returns', 'Incentives', 'Outstanding', 'Last Activity', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">No suppliers found.</td></tr>
                  )}
                  {filtered.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors cursor-pointer">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{s.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{s.phone}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{fmt(s.totalPurchases)}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 font-medium">{fmt(s.paid)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{fmt(s.returns)}</td>
                      <td className="px-4 py-3 text-sm text-amber-500">{fmt(s.incentives)}</td>
                      <td className={`px-4 py-3 text-sm font-bold ${s.outstanding > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {fmt(s.outstanding)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {new Date(s.lastTransaction).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${s.status === 'Cleared' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  ))}
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
