import React, { useState, useEffect, useMemo } from 'react';
import { DateFilterType } from '../../types';
import { getExpensesReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { Wallet, Tag, TrendingDown, Calendar, Search, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];
const CATEGORIES = ['All', 'Utilities', 'Salaries', 'Rent', 'Maintenance', 'Marketing', 'Supplies'];

export const ExpensesReport: React.FC = () => {
  const [filter, setFilter] = useState<DateFilterType>({
    label: 'This Month',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59),
  });
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const loadReport = async () => {
    setIsLoading(true); setError(null);
    try { setData(await getExpensesReport(filter)); }
    catch (e) { setError('Failed to load Expenses report.'); console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { loadReport(); }, [filter.label, filter.startDate?.toISOString()]);

  const fmt = (n: number) => {
    if (isNaN(n) || !isFinite(n)) return 'Rs. 0';
    return `Rs. ${Math.round(n).toLocaleString()}`;
  };

  const filtered = useMemo(() => {
    if (!data?.expenses) return [];
    return data.expenses.filter((e: any) => {
      const matchSearch = e.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.id.includes(searchTerm) || e.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = categoryFilter === 'All' || e.category === categoryFilter;
      const matchMin = !minAmount || e.amount >= Number(minAmount);
      const matchMax = !maxAmount || e.amount <= Number(maxAmount);
      return matchSearch && matchCat && matchMin && matchMax;
    });
  }, [data, searchTerm, categoryFilter, minAmount, maxAmount]);

  return (
    <ReportLayout>
      <ReportHeader
        title="Expenses Report"
        description="Full breakdown of operating expenses integrated with P&L and Cash Register."
        exportData={filtered}
        exportColumns={[
          { header: 'ID', dataKey: 'id' }, { header: 'Date', dataKey: 'date' },
          { header: 'Category', dataKey: 'category' }, { header: 'Description', dataKey: 'description' },
          { header: 'Amount', dataKey: 'amount' }, { header: 'Method', dataKey: 'paymentMethod' },
          { header: 'Added By', dataKey: 'addedBy' }, { header: 'Status', dataKey: 'status' }
        ]}
        exportSummary={data?.summary ? {
          TotalAmount: fmt(data.summary.totalAmount),
          TodayAmount: fmt(data.summary.todayAmount),
          ThisMonthAmount: fmt(data.summary.thisMonthAmount),
          TopCategory: data.summary.topCategory,
        } : undefined}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          {CATEGORIES.map(c => <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>)}
        </select>
        <input type="number" placeholder="Min amount" value={minAmount} onChange={e => setMinAmount(e.target.value)}
          className="w-28 py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="number" placeholder="Max amount" value={maxAmount} onChange={e => setMaxAmount(e.target.value)}
          className="w-28 py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <ReportFilters currentFilter={filter} onFilterChange={setFilter} onRefresh={loadReport} isLoading={isLoading} />
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <SummaryCard title="Total Entries" value={data.summary.totalExpenses} icon={Wallet} />
            <SummaryCard title="Period Total" value={fmt(data.summary.totalAmount)} icon={TrendingDown} valueColor="text-rose-600" />
            <SummaryCard title="Today" value={fmt(data.summary.todayAmount)} icon={Calendar} valueColor="text-amber-600" />
            <SummaryCard title="This Week" value={fmt(data.summary.thisWeekAmount)} icon={Calendar} valueColor="text-blue-600" />
            <SummaryCard title="This Month" value={fmt(data.summary.thisMonthAmount)} icon={Calendar} valueColor="text-purple-600" />
            <SummaryCard title="Top Category" value={data.summary.topCategory} icon={Tag} valueColor="text-emerald-600" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 mb-4">Daily Expense Trend</h3>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data.dailyTrend}>
                  <defs>
                    <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `Rs.${v/1000}k`} />
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <RechartsTooltip formatter={(v: any) => [`Rs. ${v.toLocaleString()}`, 'Expenses']} />
                  <Area type="monotone" dataKey="value" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#expGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 mb-4">Expenses by Category</h3>
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
              <h3 className="font-bold text-slate-800 mb-4">Category Histogram</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.byCategory} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `Rs.${v/1000}k`} />
                  <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={90} />
                  <RechartsTooltip formatter={(v: any) => `Rs. ${v.toLocaleString()}`} />
                  <Bar dataKey="value" name="Amount" radius={[0,4,4,0]}>
                    {data.byCategory.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h3 className="font-bold text-slate-800">Expenses History</h3>
              <p className="text-xs text-slate-400 mt-0.5">{filtered.length} records shown</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {['Date', 'ID', 'Category', 'Description', 'Amount', 'Method', 'Added By', 'Status'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-slate-400 text-sm">No expenses match your filters.</td></tr>}
                  {filtered.map((e: any) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-600">{e.date}</td>
                      <td className="px-4 py-3 text-sm font-medium text-amber-600">{e.id}</td>
                      <td className="px-4 py-3 text-sm"><span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">{e.category}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate">{e.description}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">Rs. {e.amount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm"><span className={`px-2 py-0.5 rounded text-xs font-medium ${e.paymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{e.paymentMethod}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-500">{e.addedBy}</td>
                      <td className="px-4 py-3 text-sm"><span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-700">{e.status}</span></td>
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
