import React, { useState, useEffect } from 'react';
import { DateFilterType } from '../../types';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, ErrorState } from '../../components/reports/ReportStates';
import { Banknote, CreditCard, Beaker, Package } from 'lucide-react';
import { saleService, SaleRecord, SalesReportAnalytics } from '../../services/sale.service';
import { getF2SalesReport } from '../../services/reportsApi';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B'];

function getThisWeekFilter(): DateFilterType {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const dow = start.getDay();
  start.setDate(start.getDate() - dow);
  return { label: 'This Week', startDate: start, endDate: end };
}

function money(n: number) {
  return Math.round(n || 0);
}

function paymentLabel(sale: SaleRecord): string {
  const method = sale.payments?.[0]?.method;
  if (sale.saleType === 'walk_in') return method === 'online' ? 'Online' : 'Cash';
  if (sale.saleType === 'split') return 'Split';
  if (sale.saleType === 'ledger_daily' || sale.saleType === 'ledger_monthly') return 'Khata';
  return sale.saleType;
}

function saleTypeLabel(saleType: string): string {
  if (saleType === 'walk_in') return 'Walk-in';
  if (saleType === 'split') return 'Split';
  if (saleType === 'ledger_daily') return 'Daily Ledger';
  if (saleType === 'ledger_monthly') return 'Monthly Ledger';
  return saleType;
}

function toInvoiceNo(id: number): string {
  return `INV-${String(id).padStart(5, '0')}`;
}

const EMPTY_ANALYTICS: SalesReportAnalytics = {
  summary: { netSales: 0, cashSales: 0, onlineSales: 0, splitSales: 0, totalBills: 0 },
  trend: [],
  paymentMethods: [],
  categoryBreakdown: [],
};

export const F2SalesReport: React.FC = () => {
  const [filter, setFilter] = useState<DateFilterType>(getThisWeekFilter);
  const [isLoading, setIsLoading] = useState(false);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [analytics, setAnalytics] = useState<SalesReportAnalytics>(EMPTY_ANALYTICS);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getF2SalesReport(filter);
      setSales(result.sales || []);
      setAnalytics(result.analytics || EMPTY_ANALYTICS);
    } catch (e: any) {
      setError(e?.message || 'Failed to load F2 Sales report.');
      setSales([]);
      setAnalytics(EMPTY_ANALYTICS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [filter.label, filter.startDate?.toISOString(), filter.endDate?.toISOString()]);

  const { summary } = analytics;

  const exportRows = sales.map((s) => ({
    id: toInvoiceNo(s.id),
    date: new Date(s.createdAt).toLocaleDateString(),
    time: new Date(s.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    customer: s.customerName || (s.saleType === 'walk_in' ? 'Walk-in' : s.saleType === 'split' ? 'Split' : 'Not Available'),
    saleType: saleTypeLabel(s.saleType),
    paymentMethod: paymentLabel(s),
    total: s.totalAmount,
    paid: s.paidAmount,
    status: s.status,
  }));

  return (
    <ReportLayout>
      <ReportHeader
        title="F2 Sales Report"
        description="Sales specifically for Lassi, Butter, and Ghee."
        exportData={exportRows}
        exportColumns={[
          { header: 'Invoice No', dataKey: 'id' },
          { header: 'Date', dataKey: 'date' },
          { header: 'Time', dataKey: 'time' },
          { header: 'Customer', dataKey: 'customer' },
          { header: 'Sale Type', dataKey: 'saleType' },
          { header: 'Payment Method', dataKey: 'paymentMethod' },
          { header: 'Total Amount', dataKey: 'total' },
          { header: 'Status', dataKey: 'status' },
        ]}
      />

      <ReportFilters
        currentFilter={filter}
        onFilterChange={setFilter}
        onRefresh={loadReport}
        isLoading={isLoading}
      />

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error} onRetry={loadReport} />
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Net F2 Sales"
              value={`Rs. ${money(summary.netSales).toLocaleString()}`}
              icon={Banknote}
              valueColor="text-emerald-700"
            />
            <SummaryCard
              title="F2 Bills"
              value={summary.totalBills.toString()}
              icon={Package}
              valueColor="text-blue-700"
            />
            <SummaryCard
              title="Cash Sales"
              value={`Rs. ${money(summary.cashSales).toLocaleString()}`}
              icon={Banknote}
              valueColor="text-amber-700"
            />
            <SummaryCard
              title="Credit / Split"
              value={`Rs. ${money(summary.splitSales).toLocaleString()}`}
              icon={CreditCard}
              valueColor="text-rose-700"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 col-span-2">
              <h3 className="font-bold text-slate-800 mb-6">F2 Sales Trend</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} tickFormatter={(v: number) => `Rs.${v}`} dx={-10} />
                    <RechartsTooltip
                      cursor={{ fill: '#F1F5F9' }}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-bold text-slate-800 mb-6">F2 Product Breakdown</h3>
              <div className="h-[300px]">
                {analytics.categoryBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={analytics.categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        dataKey="value"
                        nameKey="label"
                      >
                        {analytics.categoryBreakdown.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                    No data for selected period
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <Beaker className="w-5 h-5 text-blue-600" />
                F2 Transactions
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-6 py-4">Invoice</th>
                    <th className="px-6 py-4">Date & Time</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Payment</th>
                    <th className="px-6 py-4">F2 Items</th>
                    <th className="px-6 py-4 text-right">Bill Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sales.map((sale) => {
                    const f2Items = sale.items?.filter(item =>
                      ['lassi', 'butter', 'ghee'].includes(item.itemName?.toLowerCase())
                    ) || [];
                    return (
                      <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4 font-bold text-slate-800">{toInvoiceNo(sale.id)}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium">{new Date(sale.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs text-slate-500">
                            {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-bold">{sale.customerName || 'Walk-in'}</td>
                        <td className="px-6 py-4">
                          <span className="text-xs uppercase font-semibold text-slate-500">{paymentLabel(sale)}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {f2Items.map(item => (
                              <div key={item.id} className="flex justify-between text-xs bg-amber-50 px-2 py-1 rounded">
                                <span className="font-medium text-slate-700">{item.itemName}</span>
                                <span className="font-bold text-slate-900">{item.quantity} kg</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          Rs. {money(sale.totalAmount).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                        No F2 sales found for this period.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ReportLayout>
  );
};
