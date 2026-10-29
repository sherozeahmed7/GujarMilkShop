import React, { useState, useEffect } from 'react';
import { getInventoryReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { ReportFilters } from '../../components/reports/ReportFilters';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { Package, AlertTriangle, XCircle, DollarSign, Tag, Search, RefreshCw, Droplets } from 'lucide-react';
import { DateFilterType } from '../../types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Pagination } from '../../components/common/Pagination';
import { useChartTheme } from '../../hooks/useChartTheme';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export const InventoryReport: React.FC = () => {
  const { grid, axis, tooltipStyle, tooltipLabelStyle } = useChartTheme();
  const [filter, setFilter] = useState<DateFilterType>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return {
      label: 'Today',
      startDate: today,
      endDate: end,
    };
  });
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [receiptPage, setReceiptPage] = useState(1);
  const [receiptsPerPage, setReceiptsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
    setReceiptPage(1);
  }, [searchTerm, categoryFilter, supplierFilter, statusFilter, filter.label, filter.startDate?.toISOString()]);

  const loadReport = async () => {
    setIsLoading(true); setError(null);
    try {
      const result = await getInventoryReport(filter, supplierFilter);
      setData(result);
    } catch (e) {
      setError('Failed to load Inventory report.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [filter.label, filter.startDate?.toISOString(), filter.endDate?.toISOString(), supplierFilter]);

  const fmt = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

  const filtered = (data?.products || []).filter((p: any) => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
    const matchSup = supplierFilter === 'All' || p.supplier === supplierFilter;
    const matchStat = statusFilter === 'All' || p.stockStatus === statusFilter;
    return matchSearch && matchCat && matchSup && matchStat;
  });

  const receipts: any[] = data?.supplierMilkReceipts || [];
  const totalReceiptMilk = receipts.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
  const totalReceiptCost = receipts.reduce((sum, r) => sum + (Number(r.purchaseCost) || 0), 0);
  const weightedReceiptRate = totalReceiptMilk > 0 ? (totalReceiptCost / totalReceiptMilk) : 0;

  return (
    <ReportLayout>
      <ReportHeader
        title="Inventory Report"
        description="Current stock levels, dynamic milk receiving costs, and valuation."
        exportData={filtered}
        exportColumns={[
          { header: 'SKU', dataKey: 'sku' }, { header: 'Product', dataKey: 'name' },
          { header: 'Category', dataKey: 'category' }, { header: 'Current Stock', dataKey: 'stock' },
          { header: 'Purchase Cost', dataKey: 'costPrice' }, { header: 'Selling Price', dataKey: 'salePrice' },
          { header: 'Inventory Value', dataKey: 'inventoryValue' }, { header: 'Status', dataKey: 'stockStatus' }
        ]}
        exportSummary={data?.summary ? {
          totalProducts: data.summary.totalProducts,
          totalStockUnits: data.summary.totalStock,
          milkReceived: `${(data.summary.totalMilkReceived || 0).toFixed(2)} KG`,
          averageMilkRate: `Rs. ${(data.summary.averageMilkRate || 0).toFixed(2)}/KG`,
          milkPurchaseCost: fmt(data.summary.totalMilkCost || 0),
          costValue: fmt(data.summary.costValue),
          retailValue: fmt(data.summary.estimatedRetailValue),
        } : undefined}
      />

      {/* Date Filter Toolbar */}
      <ReportFilters
        currentFilter={filter}
        onFilterChange={setFilter}
        onRefresh={loadReport}
        isLoading={isLoading}
        allowAllTime
      />

      {/* Product & Supplier Search / Filtering */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#1a2e1f] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35]">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#64916e] absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search product by name or SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="py-2 px-3 text-sm bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="All">All Categories</option>
          {data?.categories?.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} className="py-2 px-3 text-sm bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium">
          <option value="All">All Suppliers</option>
          {data?.supplierOptions?.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="py-2 px-3 text-sm bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="All">All Statuses</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>
        <button onClick={loadReport} disabled={isLoading} className="p-2 border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124] rounded-lg transition-colors">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          {/* Dynamic Milk Receiving KPI Section */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SummaryCard
              title="Milk Received"
              value={data.summary.totalMilkReceived > 0 ? `${Number(data.summary.totalMilkReceived).toLocaleString(undefined, { maximumFractionDigits: 2 })} KG` : '0 KG'}
              icon={Droplets}
              valueColor="text-blue-600 dark:text-blue-400"
            />
            <SummaryCard
              title="Average Milk Rate"
              value={data.summary.averageMilkRate > 0 ? `Rs. ${Number(data.summary.averageMilkRate).toFixed(2)}/KG` : 'Rs. 0'}
              icon={DollarSign}
              valueColor="text-amber-600 dark:text-amber-400"
            />
            <SummaryCard
              title="Milk Purchase Cost"
              value={fmt(data.summary.totalMilkCost || 0)}
              icon={Tag}
              valueColor="text-emerald-600 dark:text-emerald-400"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard title="Total Products" value={data.summary.totalProducts} icon={Package} />
            <SummaryCard title="Total Stock Units" value={data.summary.totalStock} icon={Package} valueColor="text-blue-600 dark:text-blue-400" />
            <SummaryCard title="Low Stock Items" value={data.summary.lowStockItems} icon={AlertTriangle} valueColor="text-amber-500 dark:text-amber-400" />
            <SummaryCard title="Out of Stock" value={data.summary.outOfStockItems} icon={XCircle} valueColor="text-rose-600 dark:text-rose-400" />
            <SummaryCard title="Cost Value" value={fmt(data.summary.costValue)} icon={DollarSign} />
            <SummaryCard title="Retail Value" value={fmt(data.summary.estimatedRetailValue)} icon={Tag} valueColor="text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 h-[300px] flex flex-col">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-2">Stock Value by Category</h3>
              {(() => {
                const chartData = (data.valueByCategory || []).filter((item: any) => (item.value || 0) > 0);
                if (chartData.length === 0) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">
                      No stock value data available
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
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-2">Low Stock Products</h3>
              {(() => {
                const chartData = (data.lowStockProducts || []);
                if (chartData.length === 0) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">
                      All products have healthy stock levels
                    </div>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={grid} />
                      <XAxis type="number" stroke={axis} fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" stroke={axis} fontSize={11} tickLine={false} axisLine={false} width={100} />
                      <RechartsTooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                      <Bar dataKey="value" name="Current Stock" fill="#EF4444" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="max" name="Min Level" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Inventory Status</h3>
                <p className="text-xs text-slate-500 dark:text-[#64916e] mt-0.5">Current stock on hand and valuation for: <span className="font-medium text-slate-700 dark:text-[#a7c4ae]">{filter.label}</span></p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0">
                  <tr>
                    {['Product', 'SKU', 'Category', 'Current Stock', 'Purchase Cost', 'Selling Price', 'Inventory Value', 'Status', 'Last Updated'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 dark:text-[#64916e] text-sm">No products found matching your filters.</td></tr>
                  )}
                  {filtered
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((p: any) => (
                    <tr key={p.sku} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-[#e2f5e8]">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#8ba895]">{p.sku}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-[#8ba895] rounded text-xs font-medium">{p.category}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{p.currentStock ?? p.stock}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">{fmt(p.costPrice)}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 dark:text-blue-400 font-medium">{fmt(p.salePrice)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-[#e2f5e8]">{fmt(p.inventoryValue)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          p.stockStatus === 'In Stock' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' :
                          p.stockStatus === 'Low Stock' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' :
                          'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400'
                        }`}>
                          {p.stockStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#8ba895]">{new Date(p.lastUpdated).toLocaleDateString()}</td>
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
                itemLabel="products"
              />
            )}
          </div>

          {/* Supplier Milk Receiving Details Table */}
          <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex justify-between items-center">
              <div>
                <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Supplier Milk Receiving Details</h3>
                <p className="text-xs text-slate-500 dark:text-[#64916e] mt-0.5">
                  Actual supplier milk purchase receipts for the selected period ({filter.label})
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200 dark:border-blue-800/50">
                {receipts.length} Receipt{receipts.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase">Supplier</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase text-right">Milk Received</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase text-right">Rate</th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase text-right">Purchase Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {receipts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-400 dark:text-[#64916e] text-sm">
                        No supplier milk receiving records found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {receipts
                        .slice((receiptPage - 1) * receiptsPerPage, receiptPage * receiptsPerPage)
                        .map((r: any) => (
                          <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                            <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae] whitespace-nowrap">
                              {r.date} {r.shift ? `(${r.shift})` : ''}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-[#e2f5e8]">
                              {r.supplierName} {r.supplierCode ? `· ${r.supplierCode}` : ''}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-blue-600 dark:text-blue-400 text-right tabular-nums">
                              {Number(r.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })} KG
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold text-slate-700 dark:text-[#e2f5e8] text-right tabular-nums">
                              Rs. {Number(r.rate).toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm font-bold text-emerald-600 dark:text-emerald-400 text-right tabular-nums">
                              Rs. {Math.round(r.purchaseCost).toLocaleString()}
                            </td>
                          </tr>
                        ))}

                      {/* Grand Total Row calculated from the entire filtered dataset */}
                      <tr className="bg-slate-100 dark:bg-[#111e14] border-t-2 border-slate-300 dark:border-[#2d4a35] font-bold">
                        <td className="px-4 py-3 text-xs font-bold text-slate-600 dark:text-[#a7c4ae] uppercase tracking-wider" colSpan={2}>
                          Grand Total ({receipts.length} record{receipts.length === 1 ? '' : 's'})
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-blue-700 dark:text-blue-400 text-right tabular-nums">
                          {totalReceiptMilk.toLocaleString(undefined, { maximumFractionDigits: 2 })} KG
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-[#e2f5e8] text-right tabular-nums">
                          {weightedReceiptRate > 0 ? `≈ Rs. ${weightedReceiptRate.toFixed(2)}/KG` : 'Rs. 0'}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-400 text-right tabular-nums">
                          Rs. {Math.round(totalReceiptCost).toLocaleString()}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {receipts.length > 0 && (
              <Pagination
                currentPage={receiptPage}
                totalItems={receipts.length}
                itemsPerPage={receiptsPerPage}
                onPageChange={setReceiptPage}
                onItemsPerPageChange={setReceiptsPerPage}
                itemLabel="records"
              />
            )}
          </div>
        </>
      )}
      {!isLoading && !error && !data && <EmptyState onRefresh={loadReport} />}
    </ReportLayout>
  );
};
