import React, { useState } from 'react';
import { Search, PlusCircle, Edit2, Lock, Trash2 } from 'lucide-react';
import { Product } from '../../types/inventory';

interface ProductsTabProps {
  products: Product[];
  onAddStockClick: (productId: string) => void;
  onEditClick: (product: Product) => void;
  onDeleteClick: (product: Product) => void;
}

export const ProductsTab: React.FC<ProductsTabProps> = ({
  products,
  onAddStockClick,
  onEditClick,
  onDeleteClick
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('All Status');

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesStatus = statusFilter === 'All Status' || p.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const formatCurrency = (n: number) => `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  // Extract unique categories for filter
  const categories = Array.from(new Set(products.map(p => p.category)));

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Filters */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow" 
            placeholder="Search by name or code..." 
          />
        </div>
        <select 
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:w-40"
        >
          <option value="ALL">ALL CATEGORIES</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select 
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:w-40"
        >
          <option value="All Status">All Status</option>
          <option value="In Stock">In Stock</option>
          <option value="Warning: Low">Warning: Low</option>
          <option value="Out of Stock">Out of Stock</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm border-b border-slate-200">
            <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Sell Price</th>
              <th className="px-4 py-3">Cost</th>
              <th className="px-4 py-3">Tax</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-4 py-3 text-sm font-medium text-slate-700">{product.code}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{product.name}</span>
                    <span className="text-sm text-slate-500">{product.description}</span>
                    {product.tags.map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 uppercase tracking-wider">
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{product.category}</td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                  {product.stock.toFixed(2)} {product.unit}
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-700">{formatCurrency(product.sellPrice)}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-500">{formatCurrency(product.cost)}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-600">
                    {product.tax}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${
                    product.status === 'In Stock' ? 'bg-emerald-100 text-emerald-700' :
                    product.status === 'Warning: Low' ? 'bg-amber-100 text-amber-700' :
                    'bg-rose-100 text-rose-700'
                  }`}>
                    {product.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onAddStockClick(product.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Adjust Stock">
                      <PlusCircle className="w-4 h-4" />
                    </button>
                    <button onClick={() => onEditClick(product)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {product.isLocked ? (
                      <button className="p-1.5 text-slate-400 hover:bg-slate-100 rounded cursor-not-allowed" title="Locked">
                        <Lock className="w-4 h-4" />
                      </button>
                    ) : (
                      <button onClick={() => onDeleteClick(product)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-sm">
                  {products.length === 0 ? "No products available. Add a product to get started." : "No products found matching your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
