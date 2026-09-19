import React, { useState, useEffect } from 'react';
import { DateFilterType } from '../../types';
import { getCustomerReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { Users, Banknote, CreditCard, AlertCircle, TrendingUp, Undo2, ClipboardList } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { CustomerMonthlyStatement } from '../../components/reports/CustomerMonthlyStatement';
import { Pagination } from '../../components/common/Pagination';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

interface SelectedCustomer {
  id: number;
  name: string;
  phone: string | null;
}

export const CustomerReport: React.FC = () => {
  const [filter, setFilter] = useState<DateFilterType>({
    label: 'This Month',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)
  });
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter.label, filter.startDate?.toISOString(), searchTerm]);

  const loadReport = async () => {
    setIsLoading(true); setError(null);
    try {
      const result = await getCustomerReport(filter);
      setData(result);
    } catch (e) {
      setError('Failed to load Customer report.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [filter.label, filter.startDate?.toISOString()]);

  const fmt = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

  const filtered = (data?.customers || []).filter((c: any) =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm)
  );

  // ── Drill-down: show monthly statement for selected customer ──
  if (selectedCustomer) {
    return (
      <ReportLayout>
        <CustomerMonthlyStatement
          customerId={selectedCustomer.id}
          customerName={selectedCustomer.name}
          customerPhone={selectedCustomer.phone}
          onBack={() => setSelectedCustomer(null)}
        />
      </ReportLayout>
    );
  }

  return (
    <ReportLayout>
      <ReportHeader
        title="Customer Report"
        description="Analysis of customer sales, payments, and outstanding credit. Click a customer to view their Monthly Milk Statement."
        exportData={filtered}
        exportColumns={[
          { header: 'Customer', dataKey: 'name' }, { header: 'Phone', dataKey: 'phone' },
          { header: 'Total Sales', dataKey: 'totalSales' }, { header: 'Paid', dataKey: 'paid' },
          { header: 'Credit Sales', dataKey: 'credit' }, { header: 'Outstanding', dataKey: 'outstanding' },
          { header: 'Last Purchase', dataKey: 'lastPurchase' }, { header: 'Status', dataKey: 'isActive' }
        ]}
        exportSummary={data?.summary ? {
          totalCustomers: data.summary.totalCustomers,
          totalSales: fmt(data.summary.totalCustomerSales),
          totalCollected: fmt(data.summary.totalCollected),
          totalOutstanding: fmt(data.summary.totalOutstanding),
          creditSales: fmt(data.summary.creditSales),
          customerReturns: fmt(data.summary.customerReturns),
        } : undefined}
      />
      <ReportFilters currentFilter={filter} onFilterChange={setFilter} onRefresh={loadReport} searchTerm={searchTerm} onSearchChange={setSearchTerm} isLoading={isLoading} />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard title="Total Customers" value={data.summary.totalCustomers} icon={Users} />
            <SummaryCard title="Total Sales" value={fmt(data.summary.totalCustomerSales)} icon={TrendingUp} valueColor="text-blue-600" />
            <SummaryCard title="Total Collected" value={fmt(data.summary.totalCollected)} icon={Banknote} valueColor="text-emerald-600" />
            <SummaryCard title="Total Outstanding" value={fmt(data.summary.totalOutstanding)} icon={AlertCircle} valueColor="text-rose-600" />
            <SummaryCard title="Credit Sales" value={fmt(data.summary.creditSales)} icon={CreditCard} valueColor="text-amber-600" />
            <SummaryCard title="Customer Returns" value={fmt(data.summary.customerReturns)} icon={Undo2} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 mb-4">Customer Sales Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `Rs.${v/1000}k`} />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} />
                  <Line type="monotone" dataKey="value" name="Sales" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 mb-4">Top Customers</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.topCustomers} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `Rs.${v/1000}k`} />
                  <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={80} />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} />
                  <Bar dataKey="value" name="Sales" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="xl:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[280px]">
              <h3 className="font-bold text-slate-800 mb-4">Outstanding Customer Balances</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.outstandingChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `Rs.${v/1000}k`} />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} />
                  <Bar dataKey="value" name="Outstanding Balance" fill="#EF4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Customer Directory</h3>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <ClipboardList className="w-3.5 h-3.5" />
                Click a customer to view Monthly Milk Statement
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {['Customer', 'Phone', 'Total Sales', 'Paid', 'Credit Sales', 'Outstanding', 'Last Purchase', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">No customers found.</td></tr>
                  )}
                  {filtered
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((c: any) => (
                    <tr
                      key={c.id}
                      className="hover:bg-blue-50 transition-colors cursor-pointer group"
                      onClick={() => setSelectedCustomer({ id: c.id, name: c.name, phone: c.phone })}
                      title="Click to view Monthly Milk Statement"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 group-hover:text-blue-700">
                        <span className="flex items-center gap-1.5">
                          {c.name}
                          <ClipboardList className="w-3 h-3 text-slate-300 group-hover:text-blue-400 transition-colors" />
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600">{c.phone}</td>
                      <td className="px-4 py-3 text-sm font-medium text-blue-600">{fmt(c.totalSales)}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600">{fmt(c.paid)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{fmt(c.credit)}</td>
                      <td className={`px-4 py-3 text-sm font-bold ${c.outstanding > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                        {fmt(c.outstanding)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{new Date(c.lastPurchase).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                          {c.isActive ? 'Active' : 'Inactive'}
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
                itemLabel="customers"
              />
            )}
          </div>
        </>
      )}
      {!isLoading && !error && !data && <EmptyState onRefresh={loadReport} />}
    </ReportLayout>
  );
};
