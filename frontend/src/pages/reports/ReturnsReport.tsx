import React, { useState, useEffect } from 'react';
import { DateFilterType } from '../../types';
import { getReturnsReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { Undo2, ReceiptText, Banknote, CreditCard, Tag, FileText, Search } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export const ReturnsReport: React.FC = () => {
  const [filter, setFilter] = useState<DateFilterType>({
    label: 'This Month',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)
  });
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadReport = async () => {
    setIsLoading(true); setError(null);
    try {
      const result = await getReturnsReport(filter);
      setData(result);
    } catch (e) {
      setError('Failed to load Returns report.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [filter.label, filter.startDate?.toISOString()]);

  const fmt = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;
  
  const filtered = (data?.returns || []).filter((r: any) =>
    r.customer.toLowerCase().includes(searchTerm.toLowerCase()) || r.id.includes(searchTerm) || r.originalSaleId.includes(searchTerm)
  );

  return (
    <ReportLayout>
      <ReportHeader
        title="Returns Report"
        description="Analysis of returned items, refund methods, and return reasons."
        exportData={filtered}
        exportColumns={[
          { header: 'Return ID', dataKey: 'id' }, { header: 'Orig. Bill', dataKey: 'originalSaleId' },
          { header: 'Date', dataKey: 'date' }, { header: 'Customer', dataKey: 'customer' },
          { header: 'Items', dataKey: 'items' }, { header: 'Amount', dataKey: 'amount' },
          { header: 'Method', dataKey: 'refundMethod' }, { header: 'Reason', dataKey: 'reason' }
        ]}
      />
      <ReportFilters currentFilter={filter} onFilterChange={setFilter} onRefresh={loadReport} searchTerm={searchTerm} onSearchChange={setSearchTerm} isLoading={isLoading} />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard title="Total Returns" value={data.summary.totalReturns} icon={Undo2} />
            <SummaryCard title="Return Amount" value={fmt(data.summary.returnAmount)} icon={Banknote} valueColor="text-rose-600" />
            <SummaryCard title="Cash Refunds" value={fmt(data.summary.cashRefunds)} icon={Banknote} valueColor="text-emerald-600" />
            <SummaryCard title="Credit Refunds" value={fmt(data.summary.creditRefunds)} icon={CreditCard} valueColor="text-blue-600" />
            <SummaryCard title="Returned Bills" value={data.summary.returnedBills} icon={ReceiptText} />
            <SummaryCard title="Returned Items" value={data.summary.returnedItems} icon={Tag} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 mb-4">Return Amount Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.dailyTrend}>
                  <defs>
                    <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `Rs.${v/1000}k`} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} />
                  <Area type="monotone" dataKey="value" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorReturns)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 mb-4">Returns by Category</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data.byCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {data.byCategory.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 mb-4">Return Reasons</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.byReason} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={120} />
                  <RechartsTooltip />
                  <Bar dataKey="value" name="Occurrences" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200"><h3 className="font-bold text-slate-800">Return History</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {['Return ID', 'Orig. Bill', 'Date', 'Customer', 'Items', 'Amount', 'Method', 'Reason', 'Created By'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">No returns found for the selected period.</td></tr>
                  )}
                  {filtered.map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-rose-600">{r.id}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 hover:underline cursor-pointer">{r.originalSaleId}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{r.date}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{r.customer}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{r.items}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800">{fmt(r.amount)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.refundMethod === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                          {r.refundMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{r.reason}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{r.createdBy}</td>
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
