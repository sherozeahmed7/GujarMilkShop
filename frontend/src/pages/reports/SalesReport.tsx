import React, { useState, useEffect } from 'react';

import { DateFilterType } from '../../types';

import { ReportLayout } from '../../components/reports/ReportLayout';

import { ReportHeader } from '../../components/reports/ReportHeader';

import { ReportFilters } from '../../components/reports/ReportFilters';

import { SummaryCard } from '../../components/reports/SummaryCard';

import { LoadingState, ErrorState } from '../../components/reports/ReportStates';

import { Banknote, CreditCard, MonitorSmartphone, ReceiptText, DollarSign } from 'lucide-react';

import {

  saleService,

  SaleRecord,

  SalesReportAnalytics,

} from '../../services/sale.service';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Pagination } from '../../components/common/Pagination';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

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

function renderPieLabel(props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  value?: number;
  name?: string;
}) {
  const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, value = 0, name = '' } = props;
  if (!value) return null;

  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#334155"
      textAnchor={x >= cx ? 'start' : 'end'}
      dominantBaseline="central"
      fontSize={10}
      fontWeight={600}
    >
      {`${name} ${value}%`}
    </text>
  );
}

function paymentLabel(sale: SaleRecord): string {
  const method = sale.payments?.[0]?.method;
  if (sale.saleType === 'walk_in') {
    return method === 'online' ? 'Online' : 'Cash';
  }
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

function saleCustomerLabel(s: SaleRecord): string {
  const name = s.customerName || s.customer?.name;
  if (name?.trim()) return name;
  if (s.saleType === 'walk_in') return 'Walk-in';
  if (s.saleType === 'split') return 'Split';
  return 'Not Available';
}

function statusLabel(status: string): string {
  if (status === 'paid') return 'Paid';
  if (status === 'partial') return 'Partial';
  if (status === 'pending') return 'Pending';
  return status;
}

function toInvoiceNo(id: number): string {
  return `INV-${String(id).padStart(5, '0')}`;
}

function productsLabel(sale: SaleRecord): string {
  const items = sale.items || [];
  if (items.length === 0) return '—';
  return items
    .map((item) => {
      const name = item.itemName
        ? item.itemName.charAt(0).toUpperCase() + item.itemName.slice(1)
        : 'Item';
      const qty = Number(item.quantity) || 0;
      return `${name} (${qty} kg)`;
    })
    .join(', ');
}

const EMPTY_ANALYTICS: SalesReportAnalytics = {
  summary: {
    netSales: 0,
    cashSales: 0,
    onlineSales: 0,
    splitSales: 0,
    totalBills: 0,
  },
  trend: [],
  paymentMethods: [],
  categoryBreakdown: [],
};

export const SalesReport: React.FC = () => {
  const [filter, setFilter] = useState<DateFilterType>(getThisWeekFilter);
  const [isLoading, setIsLoading] = useState(false);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [analytics, setAnalytics] = useState<SalesReportAnalytics>(EMPTY_ANALYTICS);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter.label, filter.startDate?.toISOString()]);



  const loadReport = async () => {

    if (!filter.startDate || !filter.endDate) return;



    setIsLoading(true);

    setError(null);

    try {

      const result = await saleService.getSalesReport({

        fromDate: filter.startDate.toISOString(),

        toDate: filter.endDate.toISOString(),

      });

      setSales(result.sales || []);

      setAnalytics(result.analytics || EMPTY_ANALYTICS);

    } catch (e: any) {

      setError(e?.message || 'Failed to load Sales report.');

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

    customer: saleCustomerLabel(s),

    products: productsLabel(s),

    saleType: saleTypeLabel(s.saleType),

    paymentMethod: paymentLabel(s),

    total: s.totalAmount,

    paid: s.paidAmount,

    remaining: s.remainingBalance,

    status: statusLabel(s.status),

  }));



  const fmt = (n: number) => `Rs. ${money(n).toLocaleString()}`;



  return (

    <ReportLayout>

      <ReportHeader

        title="Sales Report"

        description="Live sales from POS — walk-in, split, and ledger bills."

        exportData={exportRows}

        exportColumns={[

          { header: 'Invoice No', dataKey: 'id' },

          { header: 'Date', dataKey: 'date' },

          { header: 'Time', dataKey: 'time' },

          { header: 'Customer', dataKey: 'customer' },

          { header: 'Products', dataKey: 'products' },

          { header: 'Sale Type', dataKey: 'saleType' },

          { header: 'Payment', dataKey: 'paymentMethod' },

          { header: 'Total', dataKey: 'total' },

          { header: 'Paid', dataKey: 'paid' },

          { header: 'Remaining', dataKey: 'remaining' },

          { header: 'Status', dataKey: 'status' },

        ]}
        exportSummary={{
          netSales: fmt(summary.netSales),
          cashSales: fmt(summary.cashSales),
          onlineSales: fmt(summary.onlineSales),
          splitBills: fmt(summary.splitSales),
          totalBills: summary.totalBills,
        }}

      />

      <ReportFilters

        currentFilter={filter}

        onFilterChange={setFilter}

        onRefresh={loadReport}

        isLoading={isLoading}

      />



      {isLoading && <LoadingState />}

      {error && <ErrorState message={error} onRetry={loadReport} />}



      {!isLoading && !error && (

        <>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">

            <SummaryCard title="Net Sales" value={fmt(summary.netSales)} icon={DollarSign} valueColor="text-emerald-600" />

            <SummaryCard title="Cash (Walk-in)" value={fmt(summary.cashSales)} icon={Banknote} valueColor="text-emerald-600" />

            <SummaryCard title="Online (Walk-in)" value={fmt(summary.onlineSales)} icon={MonitorSmartphone} valueColor="text-purple-600" />

            <SummaryCard title="Split Bills" value={fmt(summary.splitSales)} icon={CreditCard} valueColor="text-amber-600" />

            <SummaryCard title="Total Bills" value={summary.totalBills} icon={ReceiptText} />

          </div>



          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

            <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">

              <h3 className="font-bold text-slate-800 mb-1">Sales Trend</h3>

              <p className="text-[10px] text-slate-400 mb-3 uppercase tracking-wider">{filter.label}</p>

              {analytics.trend.length === 0 ? (

                <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">

                  No sales in this period.

                </div>

              ) : (

                <ResponsiveContainer width="100%" height={220}>

                  <LineChart data={analytics.trend}>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />

                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `Rs.${v / 1000}k`} />

                    <RechartsTooltip formatter={(v: any) => `Rs. ${Number(v).toLocaleString()}`} />

                    <Line type="monotone" dataKey="value" name="Net Sales" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />

                  </LineChart>

                </ResponsiveContainer>

              )}

            </div>



            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px]">

              <h3 className="font-bold text-slate-800 mb-1">Payment Methods</h3>

              <p className="text-[10px] text-slate-400 mb-3 uppercase tracking-wider">{filter.label}</p>

              {analytics.paymentMethods.length === 0 ? (

                <div className="h-[220px] flex items-center justify-center text-sm text-slate-400">

                  No payment data in this period.

                </div>

              ) : (

                <ResponsiveContainer width="100%" height={220}>

                  <PieChart>

                    <Pie
                      data={analytics.paymentMethods}
                      cx="50%"
                      cy="45%"
                      innerRadius={45}
                      outerRadius={72}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={renderPieLabel}
                      labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                    >

                      {analytics.paymentMethods.map((_, i) => (

                        <Cell key={i} fill={COLORS[i % COLORS.length]} />

                      ))}

                    </Pie>

                    <RechartsTooltip formatter={(v: any, _name: any, props: any) => {

                      const amount = props?.payload?.amount ?? 0;

                      return [`${v}% (Rs. ${Number(amount).toLocaleString()})`, props?.payload?.name];

                    }} />

                    <Legend verticalAlign="bottom" height={36} />

                  </PieChart>

                </ResponsiveContainer>

              )}

            </div>



            <div className="xl:col-span-3 bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[280px]">

              <h3 className="font-bold text-slate-800 mb-1">Sales by Category</h3>

              <p className="text-[10px] text-slate-400 mb-3 uppercase tracking-wider">{filter.label}</p>

              {analytics.categoryBreakdown.length === 0 ? (

                <div className="h-[200px] flex items-center justify-center text-sm text-slate-400">

                  No category data in this period.

                </div>

              ) : (

                <ResponsiveContainer width="100%" height={200}>

                  <BarChart data={analytics.categoryBreakdown}>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />

                    <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />

                    <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />

                    <RechartsTooltip formatter={(v: any, _name: any, props: any) => {

                      const amount = props?.payload?.amount ?? 0;

                      return [`${v}% (Rs. ${Number(amount).toLocaleString()})`, props?.payload?.label];

                    }} />

                    <Bar dataKey="value" name="Percentage" radius={[4, 4, 0, 0]}>

                      {analytics.categoryBreakdown.map((_, i) => (

                        <Cell key={i} fill={COLORS[i % COLORS.length]} />

                      ))}

                    </Bar>

                  </BarChart>

                </ResponsiveContainer>

              )}

            </div>

          </div>



          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">

              <h3 className="font-bold text-slate-800">Sales History</h3>

            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-left border-collapse min-w-[900px]">

                <thead className="bg-slate-50 sticky top-0">

                  <tr>

                    {[

                      'Invoice No',

                      'Date',

                      'Customer',

                      'Products',

                      'Sale Type',

                      'Payment',

                      'Total',

                      'Paid',

                      'Remaining',

                      'Status',

                    ].map((h) => (

                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">

                        {h}

                      </th>

                    ))}

                  </tr>

                </thead>

                <tbody className="divide-y divide-slate-100">

                  {sales
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((s) => {
                    const pay = paymentLabel(s);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-blue-600">
                          {toInvoiceNo(s.id)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          <div>{new Date(s.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs text-slate-400">
                            {new Date(s.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          <div>
                            {saleCustomerLabel(s)}
                          </div>
                          {(s.customerPhone || s.customer?.phone) && (
                            <div className="text-xs text-slate-400">{s.customerPhone || s.customer?.phone}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 max-w-[220px]">
                          <div className="truncate" title={productsLabel(s)}>
                            {productsLabel(s)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {saleTypeLabel(s.saleType)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              pay === 'Cash'
                                ? 'bg-emerald-100 text-emerald-700'
                                : pay === 'Online'
                                  ? 'bg-purple-100 text-purple-700'
                                  : pay === 'Split'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {pay}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500">{fmt(s.totalAmount)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{fmt(s.paidAmount)}</td>
                        <td className="px-4 py-3 text-sm text-rose-600 font-medium">
                          {s.remainingBalance > 0 ? fmt(s.remainingBalance) : 'Not Available'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              s.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-700'
                                : s.status === 'partial'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {statusLabel(s.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {sales.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">
                        No sales found for the selected period. Complete a sale from POS to see it here.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {sales.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={sales.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                itemLabel="sales"
              />
            )}
          </div>
        </>
      )}

    </ReportLayout>

  );

};


