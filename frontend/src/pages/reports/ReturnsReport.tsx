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
import { Pagination } from '../../components/common/Pagination';
import { useChartTheme } from '../../hooks/useChartTheme';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

import { saleService, SaleRecord } from '../../services/sale.service';
import { posConfigService, POSConfigData } from '../../services/posConfig.service';
import { ReceiptPreview } from '../../components/pos/ReceiptPreview';
import { X, Printer } from 'lucide-react';

export const ReturnsReport: React.FC = () => {
  const { grid, axis, tooltipStyle, tooltipLabelStyle } = useChartTheme();
  const [filter, setFilter] = useState<DateFilterType>({
    label: 'This Month',
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    endDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59)
  });
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [isLoadingSale, setIsLoadingSale] = useState(false);
  const [posConfig, setPosConfig] = useState<POSConfigData | null>(null);

  useEffect(() => {
    posConfigService.getPOSConfig().then(setPosConfig).catch(() => {});
  }, []);

  const handleOpenBill = async (billNumber: string) => {
    const cleanId = Number(String(billNumber).replace(/^(INV-0*|BILL-0*|#)/i, ''));
    if (!cleanId || isNaN(cleanId)) return;
    setIsLoadingSale(true);
    try {
      const sale = await saleService.getSale(cleanId);
      setSelectedSale(sale);
    } catch (e) {
      console.error('Failed to load bill', e);
    } finally {
      setIsLoadingSale(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filter.label, filter.startDate?.toISOString(), searchTerm]);

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
        exportSummary={data?.summary ? {
          totalReturns: data.summary.totalReturns,
          returnAmount: fmt(data.summary.returnAmount),
          cashRefunds: fmt(data.summary.cashRefunds),
          creditRefunds: fmt(data.summary.creditRefunds),
          returnedBills: data.summary.returnedBills,
          returnedItems: data.summary.returnedItems,
        } : undefined}
      />
      <ReportFilters currentFilter={filter} onFilterChange={setFilter} onRefresh={loadReport} searchTerm={searchTerm} onSearchChange={setSearchTerm} isLoading={isLoading} />

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard title="Total Returns" value={data.summary.totalReturns} icon={Undo2} />
            <SummaryCard title="Return Amount" value={fmt(data.summary.returnAmount)} icon={Banknote} valueColor="text-rose-600 dark:text-rose-400" />
            <SummaryCard title="Cash Refunds" value={fmt(data.summary.cashRefunds)} icon={Banknote} valueColor="text-emerald-600 dark:text-emerald-400" />
            <SummaryCard title="Credit Refunds" value={fmt(data.summary.creditRefunds)} icon={CreditCard} valueColor="text-blue-600 dark:text-blue-400" />
            <SummaryCard title="Returned Bills" value={data.summary.returnedBills} icon={ReceiptText} />
            <SummaryCard title="Returned Items" value={data.summary.returnedItems} icon={Tag} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="xl:col-span-2 bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[300px] flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-2">Return Amount Trend</h3>
              {(() => {
                const trendData = (data.dailyTrend || []);
                const hasTrend = trendData.some((t: any) => (t.value || 0) > 0);
                if (!hasTrend && trendData.length === 0) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">
                      No return trend data for this period
                    </div>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height={230}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="colorReturns" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="label" stroke={axis} fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke={axis} fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => `Rs.${v/1000}k`} />
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
                      <RechartsTooltip formatter={(v: any) => `Rs. ${Number(v || 0).toLocaleString()}`} contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                      <Area type="monotone" dataKey="value" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorReturns)" />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>

            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[300px] flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-2">Returns by Category</h3>
              {(() => {
                const catData = (data.byCategory || []).filter((c: any) => (c.value || 0) > 0);
                if (catData.length === 0) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">
                      No returned items in this period
                    </div>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height={230}>
                    <PieChart>
                      <Pie
                        data={catData}
                        cx="50%"
                        cy="45%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="value"
                        nameKey="label"
                      >
                        {catData.map((_: any, i: number) => (
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
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-2">Return Reasons</h3>
              {(() => {
                const reasonData = (data.byReason || []).filter((r: any) => (r.value || 0) > 0);
                if (reasonData.length === 0) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">
                      No return reasons recorded
                    </div>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={reasonData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={grid} />
                      <XAxis type="number" stroke={axis} fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" stroke={axis} fontSize={11} tickLine={false} axisLine={false} width={120} />
                      <RechartsTooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                      <Bar dataKey="value" name="Occurrences" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2d4a35]"><h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Return History</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0">
                  <tr>
                    {['Return ID', 'Orig. Bill', 'Date', 'Customer', 'Items', 'Amount', 'Method', 'Reason', 'Created By'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 dark:text-[#64916e] text-sm">No returns found for the selected period.</td></tr>
                  )}
                  {filtered
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((r: any) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-rose-600 dark:text-rose-400">{r.id}</td>
                      <td
                        onClick={() => handleOpenBill(r.originalSaleId)}
                        className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium font-mono"
                        title="Click to view original bill"
                      >
                        {r.originalSaleId}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">{r.date}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-[#a7c4ae]">{r.customer}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">{r.items}</td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{fmt(r.amount)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.refundMethod === 'Cash' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400'}`}>
                          {r.refundMethod}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">{r.reason}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#8ba895]">{r.createdBy}</td>
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
                itemLabel="returns"
              />
            )}
          </div>
        </>
      )}
      {!isLoading && !error && !data && <EmptyState onRefresh={loadReport} />}

      {/* Original Bill Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="relative bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0">
              <div className="flex items-center gap-2">
                <ReceiptText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">Original Bill Details</h3>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex justify-center bg-slate-50 dark:bg-[#142119]">
              <ReceiptPreview
                config={posConfig}
                sale={{
                  id: selectedSale.id,
                  tokenNumber: selectedSale.tokenNumber,
                  createdAt: selectedSale.createdAt,
                  customerName: selectedSale.customerName,
                  customerPhone: selectedSale.customerPhone,
                  totalAmount: selectedSale.totalAmount,
                  paidAmount: selectedSale.paidAmount,
                  remainingBalance: selectedSale.remainingBalance,
                  paymentMethod: selectedSale.payments?.[0]?.method || (selectedSale.saleType === 'split' ? 'Split' : 'Cash'),
                  items: selectedSale.items?.map(i => ({
                    name: i.itemName,
                    qty: i.quantity,
                    price: i.unitPrice,
                    total: i.totalPrice,
                  })) || [],
                }}
                showOuterContainer={false}
              />
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-[#2d4a35] flex justify-end gap-2 bg-white dark:bg-[#1a2e1f]">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#a7c4ae] rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors"
              >
                <Printer className="w-4 h-4" />
                Print
              </button>
              <button
                onClick={() => setSelectedSale(null)}
                className="px-4 py-2 bg-slate-800 dark:bg-[#142119] text-white dark:text-[#e2f5e8] rounded-xl text-sm font-medium hover:bg-slate-900 dark:hover:bg-[#1e3124] transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </ReportLayout>
  );
};
