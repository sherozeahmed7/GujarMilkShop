import React, { useState, useEffect } from 'react';
import { DateFilterType } from '../../types';
import { getSalesReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { Banknote, CreditCard, MonitorSmartphone, ReceiptText, Undo2, Tag, TrendingUp, DollarSign, Calculator } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export const SalesReport: React.FC = () => {
  const [filter, setFilter] = useState<DateFilterType>({
    label: 'Today',
    startDate: new Date(new Date().setHours(0, 0, 0, 0)),
    endDate: new Date(new Date().setHours(23, 59, 59, 999))
  });
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setIsLoading(true); setError(null);
    try {
      const result = await getSalesReport(filter);
      setData(result);
    } catch (e) {
      setError('Failed to load Sales report.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [filter.label, filter.startDate?.toISOString()]);

  const fmt = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

  return (
    <ReportLayout>
      <ReportHeader
        title="Sales Report"
        description="Comprehensive overview of all sales activities including cash, credit, online, and returns."
        exportData={data?.transactions || []}
        exportColumns={[
          { header: 'Bill No', dataKey: 'id' }, { header: 'Date', dataKey: 'date' },
          { header: 'Time', dataKey: 'time' }, { header: 'Customer', dataKey: 'customer' },
          { header: 'Method', dataKey: 'paymentMethod' }, { header: 'Gross', dataKey: 'gross' },
          { header: 'Discount', dataKey: 'discount' }, { header: 'Net', dataKey: 'net' },
          { header: 'Cashier', dataKey: 'cashier' }, { header: 'Status', dataKey: 'status' }
        ]}
      />
      <ReportFilters currentFilter={filter} onFilterChange={setFilter} onRefresh={loadReport} isLoading={isLoading} />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <SummaryCard title="Net Sales" value={fmt(data.summary.netSales)} icon={TrendingUp} valueColor="text-emerald-600" />
            <SummaryCard title="Cash Sales" value={fmt(data.summary.cashSales)} icon={Banknote} valueColor="text-emerald-600" />
            <SummaryCard title="Credit (Khata)" value={fmt(data.summary.creditSales)} icon={CreditCard} valueColor="text-blue-600" />
            <SummaryCard title="Online Sales" value={fmt(data.summary.onlineSales)} icon={MonitorSmartphone} valueColor="text-purple-600" />
            <SummaryCard title="Refunds" value={fmt(data.summary.refunds)} icon={Undo2} valueColor="text-rose-500" />
            <SummaryCard title="Total Bills" value={data.summary.totalBills} icon={ReceiptText} />
            <SummaryCard title="Average Bill" value={fmt(data.summary.averageBillValue)} icon={Calculator} />
            <SummaryCard title="Gross Sales" value={fmt(data.summary.totalSales)} icon={DollarSign} />
            <SummaryCard title="Discounts" value={fmt(data.summary.discounts)} icon={Tag} valueColor="text-amber-500" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 mb-4">Sales Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `Rs.${v/1000}k`} />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} />
                  <Line type="monotone" dataKey="value" name="Net Sales" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 mb-4">Payment Methods</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data.paymentMethodData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {data.paymentMethodData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip formatter={(v: any) => `${v}%`} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="xl:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[280px]">
              <h3 className="font-bold text-slate-800 mb-4">Sales by Category</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.productCategoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                  <RechartsTooltip formatter={(v: any) => `${v}%`} />
                  <Bar dataKey="value" name="Percentage" fill="#10B981" radius={[4, 4, 0, 0]}>
                    {data.productCategoryData.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Recent Transactions</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {['Bill No', 'Date', 'Customer', 'Method', 'Gross', 'Disc.', 'Net', 'Cashier', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.transactions.map((t: any) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-blue-600">{t.id}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">
                        <div>{new Date(t.date).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-400">{t.time}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{t.customer}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.paymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-700' : t.paymentMethod === 'Credit' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                          {t.paymentMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{fmt(t.gross)}</td>
                      <td className="px-4 py-3 text-sm text-amber-500">{fmt(t.discount)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800">{fmt(t.net)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{t.cashier}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.status === 'Completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {data.transactions.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">No sales found for the selected period.</td>
                    </tr>
                  )}
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
