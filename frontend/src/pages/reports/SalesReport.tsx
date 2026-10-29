import React, { useState, useEffect } from 'react';

import { DateFilterType } from '../../types';

import { ReportLayout } from '../../components/reports/ReportLayout';

import { ReportHeader } from '../../components/reports/ReportHeader';

import { ReportFilters } from '../../components/reports/ReportFilters';

import { SummaryCard } from '../../components/reports/SummaryCard';

import { LoadingState, ErrorState } from '../../components/reports/ReportStates';

import { Banknote, CreditCard, MonitorSmartphone, ReceiptText, DollarSign, Tag, X } from 'lucide-react';

import {
  saleService,
  SaleRecord,
  SalesReportAnalytics,
  DiscountSaleItem,
} from '../../services/sale.service';
import { formatUserName } from '../../utils/userFormat';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Pagination } from '../../components/common/Pagination';
import { useChartTheme } from '../../hooks/useChartTheme';

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
    totalDiscount: 0,
  },
  trend: [],
  paymentMethods: [],
  categoryBreakdown: [],
  discountSales: [],
};

export const SalesReport: React.FC = () => {
  const { grid, axis, tooltipStyle, tooltipLabelStyle } = useChartTheme();
  const [filter, setFilter] = useState<DateFilterType>(getThisWeekFilter);
  const [isLoading, setIsLoading] = useState(false);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [analytics, setAnalytics] = useState<SalesReportAnalytics>(EMPTY_ANALYTICS);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [discountModalOpen, setDiscountModalOpen] = useState(false);

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

      setAnalytics({ ...EMPTY_ANALYTICS, ...(result.analytics || {}), summary: { ...EMPTY_ANALYTICS.summary, ...(result.analytics?.summary || {}) } });

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

    createdBy: formatUserName(s.createdByName),

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

    <>

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

          { header: 'Created By', dataKey: 'createdBy' },

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

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">

            <SummaryCard title="Net Sales" value={fmt(summary.netSales)} icon={DollarSign} valueColor="text-emerald-600 dark:text-emerald-400" />

            <SummaryCard title="Cash (Walk-in)" value={fmt(summary.cashSales)} icon={Banknote} valueColor="text-emerald-600 dark:text-emerald-400" />

            <SummaryCard title="Online (Walk-in)" value={fmt(summary.onlineSales)} icon={MonitorSmartphone} valueColor="text-purple-600 dark:text-purple-400" />

            <SummaryCard title="Split Bills" value={fmt(summary.splitSales)} icon={CreditCard} valueColor="text-amber-600 dark:text-amber-400" />

            <SummaryCard title="Total Bills" value={summary.totalBills} icon={ReceiptText} />

            {/* Discount card — clickable */}
            <button
              onClick={() => setDiscountModalOpen(true)}
              className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 flex flex-col justify-between text-left hover:ring-2 hover:ring-rose-400/60 hover:border-rose-300 dark:hover:border-rose-500 transition-all group"
              title="Click to see discount breakdown"
            >
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-semibold text-slate-500 dark:text-[#8ba895] group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">Discounts</h4>
                <Tag className="w-5 h-5 text-rose-400 dark:text-rose-500" />
              </div>
              <div>
                <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
                  {fmt(summary.totalDiscount)}
                </div>
                <div className="text-xs text-slate-400 dark:text-[#64916e] mt-1">
                  {analytics.discountSales.length} sale{analytics.discountSales.length !== 1 ? 's' : ''} with discount
                </div>
              </div>
            </button>

          </div>



          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-1">Sales Trend</h3>

              <p className="text-[10px] text-slate-400 dark:text-[#8ba895] mb-3 uppercase tracking-wider">{filter.label}</p>

              {analytics.trend.length === 0 ? (

                <div className="h-[220px] flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">

                  No sales in this period.

                </div>

              ) : (

                <ResponsiveContainer width="100%" height={220}>

                  <LineChart data={analytics.trend}>

                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />

                    <XAxis dataKey="label" stroke={axis} fontSize={10} tickLine={false} axisLine={false} />

                    <YAxis stroke={axis} fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `Rs.${v / 1000}k`} />

                    <RechartsTooltip formatter={(v: any) => `Rs. ${Number(v).toLocaleString()}`} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />

                    <Line type="monotone" dataKey="value" name="Net Sales" stroke="#3B82F6" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />

                  </LineChart>

                </ResponsiveContainer>

              )}

            </div>



            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[300px]">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-1">Payment Methods</h3>

              <p className="text-[10px] text-slate-400 dark:text-[#8ba895] mb-3 uppercase tracking-wider">{filter.label}</p>

              {analytics.paymentMethods.length === 0 ? (

                <div className="h-[220px] flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">

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

                    <RechartsTooltip
                      formatter={(v: any, _name: any, props: any) => {

                      const amount = props?.payload?.amount ?? 0;

                      return [`${v}% (Rs. ${Number(amount).toLocaleString()})`, props?.payload?.name];

                    }}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                    />

                    <Legend verticalAlign="bottom" height={36} />

                  </PieChart>

                </ResponsiveContainer>

              )}

            </div>



            <div className="xl:col-span-3 bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[280px]">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-1">Sales by Category</h3>
              <p className="text-[10px] text-slate-400 dark:text-[#8ba895] mb-3 uppercase tracking-wider">{filter.label}</p>
              {analytics.categoryBreakdown.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">
                  No category data in this period.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.categoryBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                    <XAxis dataKey="label" stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={axis} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                    <RechartsTooltip
                      formatter={(v: any, _name: any, props: any) => {
                      const amount = props?.payload?.amount ?? 0;
                      return [`${v}% (Rs. ${Number(amount).toLocaleString()})`, props?.payload?.label];
                    }}
                      contentStyle={tooltipStyle}
                      labelStyle={tooltipLabelStyle}
                    />
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

          <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex justify-between items-center">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Sales History</h3>
            </div>

            <div className="overflow-x-auto">

              <table className="w-full text-left border-collapse min-w-[900px]">

                <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0">

                  <tr>

                    {[
                      'Invoice No',
                      'Date',
                      'Customer',
                      'Created By',
                      'Products',
                      'Sale Type',
                      'Payment',
                      'Total',
                      'Paid',
                      'Remaining',
                      'Status',
                    ].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {sales
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((s) => {
                    const pay = paymentLabel(s);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">
                          {toInvoiceNo(s.id)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">
                          <div>{new Date(s.createdAt).toLocaleDateString()}</div>
                          <div className="text-xs text-slate-400 dark:text-[#64916e]">
                            {new Date(s.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-[#e2f5e8]">
                          <div>
                            {saleCustomerLabel(s)}
                          </div>
                          {(s.customerPhone || s.customer?.phone) && (
                            <div className="text-xs text-slate-400 dark:text-[#64916e]">{s.customerPhone || s.customer?.phone}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-[#e2f5e8]">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-[#1f3524] text-slate-700 dark:text-[#a7c4ae]">
                            {formatUserName(s.createdByName)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-[#a7c4ae] max-w-[220px]">
                          <div className="truncate" title={productsLabel(s)}>
                            {productsLabel(s)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">
                          {saleTypeLabel(s.saleType)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              pay === 'Cash'
                                ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                : pay === 'Online'
                                  ? 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400'
                                  : pay === 'Split'
                                    ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400'
                                    : 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400'
                            }`}
                          >
                            {pay}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#8ba895]">{fmt(s.totalAmount)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700 dark:text-[#e2f5e8]">{fmt(s.paidAmount)}</td>
                        <td className="px-4 py-3 text-sm text-rose-600 dark:text-rose-400 font-medium">
                          {s.remainingBalance > 0 ? fmt(s.remainingBalance) : 'Not Available'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              s.status === 'paid'
                                ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                                : s.status === 'partial'
                                  ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-400'
                                  : 'bg-slate-100 dark:bg-[#142119] text-slate-600 dark:text-[#a7c4ae]'
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
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-400 dark:text-[#64916e] text-sm">
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

    {/* ── Discount Breakdown Modal ─────────────────────────────────────── */}
    {discountModalOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) setDiscountModalOpen(false); }}
      >
        <div className="relative bg-white dark:bg-[#142119] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#2d4a35] w-full max-w-2xl max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#2d4a35]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-100 dark:bg-rose-500/15 flex items-center justify-center">
                <Tag className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-[#e2f5e8]">Discount Breakdown</h2>
                <p className="text-xs text-slate-400 dark:text-[#8ba895]">{filter.label}</p>
              </div>
            </div>
            <button
              onClick={() => setDiscountModalOpen(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-[#1e3124] text-slate-400 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Summary row */}
          <div className="px-6 py-3 bg-rose-50 dark:bg-rose-500/10 border-b border-rose-100 dark:border-rose-500/20 flex gap-6">
            <div>
              <p className="text-xs text-slate-400 dark:text-[#8ba895] uppercase tracking-wider">Total Discounts Given</p>
              <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{fmt(summary.totalDiscount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 dark:text-[#8ba895] uppercase tracking-wider">No. of Sales</p>
              <p className="text-xl font-bold text-slate-700 dark:text-[#e2f5e8]">{analytics.discountSales.length}</p>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-y-auto flex-1">
            {analytics.discountSales.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-[#64916e]">
                <Tag className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm">No discounts were given in this period.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 dark:bg-[#0f1a12] sticky top-0">
                  <tr>
                    {['Date', 'Customer', 'Original Price', 'Discount', 'After Discount'].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {(analytics.discountSales as DiscountSaleItem[]).map((d, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#a7c4ae]">
                        <div>{new Date(d.createdAt).toLocaleDateString()}</div>
                        <div className="text-xs text-slate-400 dark:text-[#64916e]">
                          {new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-[#e2f5e8]">
                        {d.customerName || (d.saleType === 'walk_in' ? 'Walk-in' : saleTypeLabel(d.saleType))}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#8ba895]">{fmt(d.originalAmount)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-400">− {fmt(d.discountAmount)}</td>
                      <td className="px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmt(d.afterDiscountAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )}
  </>
  );

};


