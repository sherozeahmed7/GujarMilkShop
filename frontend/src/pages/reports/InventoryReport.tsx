import React, { useState, useEffect } from 'react';
import { getInventoryReport } from '../../services/reportsApi';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { Package, AlertTriangle, XCircle, DollarSign, Tag, Search, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { Pagination } from '../../components/common/Pagination';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6'];

export const InventoryReport: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [supplierFilter, setSupplierFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, supplierFilter, statusFilter]);

  const loadReport = async () => {
    setIsLoading(true); setError(null);
    try {
      const result = await getInventoryReport();
      setData(result);
    } catch (e) {
      setError('Failed to load Inventory report.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, []);

  const fmt = (n: number) => `Rs. ${Math.round(n || 0).toLocaleString()}`;

  const filtered = (data?.products || []).filter((p: any) => {
    const matchSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = categoryFilter === 'All' || p.category === categoryFilter;
    const matchSup = supplierFilter === 'All' || p.supplier === supplierFilter;
    const matchStat = statusFilter === 'All' || p.stockStatus === statusFilter;
    return matchSearch && matchCat && matchSup && matchStat;
  });

  return (
    <ReportLayout>
      <ReportHeader
        title="Inventory Report"
        description="Current stock levels, valuation, and low stock alerts."
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
          lowStockItems: data.summary.lowStockItems,
          outOfStock: data.summary.outOfStockItems,
          costValue: fmt(data.summary.costValue),
          retailValue: fmt(data.summary.estimatedRetailValue),
        } : undefined}
      />

      {/* Real-time filters (no date filter for inventory) */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search by name or SKU..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="All">All Categories</option>
          {data?.categories?.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={supplierFilter} onChange={e => setSupplierFilter(e.target.value)} className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="All">All Suppliers</option>
          {data?.suppliers?.map((s: string) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="All">All Statuses</option>
          <option value="In Stock">In Stock</option>
          <option value="Low Stock">Low Stock</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>
        <button onClick={loadReport} disabled={isLoading} className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard title="Total Products" value={data.summary.totalProducts} icon={Package} />
            <SummaryCard title="Total Stock Units" value={data.summary.totalStock} icon={Package} valueColor="text-blue-600" />
            <SummaryCard title="Low Stock Items" value={data.summary.lowStockItems} icon={AlertTriangle} valueColor="text-amber-500" />
            <SummaryCard title="Out of Stock" value={data.summary.outOfStockItems} icon={XCircle} valueColor="text-rose-600" />
            <SummaryCard title="Cost Value" value={fmt(data.summary.costValue)} icon={DollarSign} />
            <SummaryCard title="Retail Value" value={fmt(data.summary.estimatedRetailValue)} icon={Tag} valueColor="text-emerald-600" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px] flex flex-col">
              <h3 className="font-bold text-slate-800 mb-2">Stock Value by Category</h3>
              {(() => {
                const chartData = (data.valueByCategory || []).filter((item: any) => (item.value || 0) > 0);
                if (chartData.length === 0) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
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
                      <RechartsTooltip formatter={(v: any) => `Rs. ${Number(v || 0).toLocaleString()}`} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 h-[300px] flex flex-col">
              <h3 className="font-bold text-slate-800 mb-2">Low Stock Products</h3>
              {(() => {
                const chartData = (data.lowStockProducts || []);
                if (chartData.length === 0) {
                  return (
                    <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                      All products have healthy stock levels
                    </div>
                  );
                }
                return (
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                      <XAxis type="number" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={100} />
                      <RechartsTooltip />
                      <Bar dataKey="value" name="Current Stock" fill="#EF4444" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="max" name="Min Level" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Inventory Status</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    {['Product', 'SKU', 'Category', 'Current Stock', 'Purchase Cost', 'Selling Price', 'Inventory Value', 'Status', 'Last Updated'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.length === 0 && (
                    <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400 text-sm">No products found matching your filters.</td></tr>
                  )}
                  {filtered
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((p: any) => (
                    <tr key={p.sku} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{p.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-500">{p.sku}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">{p.category}</span>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-slate-700">{p.stock}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{fmt(p.costPrice)}</td>
                      <td className="px-4 py-3 text-sm text-blue-600 font-medium">{fmt(p.salePrice)}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800">{fmt(p.inventoryValue)}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          p.stockStatus === 'In Stock' ? 'bg-emerald-100 text-emerald-700' :
                          p.stockStatus === 'Low Stock' ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          {p.stockStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{new Date(p.lastUpdated).toLocaleDateString()}</td>
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
        </>
      )}
      {!isLoading && !error && !data && <EmptyState onRefresh={loadReport} />}
    </ReportLayout>
  );
};
