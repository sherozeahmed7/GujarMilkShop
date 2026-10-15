import React, { useState, useEffect } from 'react';
import { Search, PlusCircle, Edit2, Lock, Trash2 } from 'lucide-react';
import { Product } from '../../types/inventory';
import { Pagination } from '../common/Pagination';

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
  onDeleteClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredProducts = products.filter(p => {
    return (p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const formatCurrency = (n: number) => `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-[#1a2e1f]">
      {/* Filters */}
      <div className="p-4 border-b border-slate-200 dark:border-[#2d4a35] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#64916e]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow"
            placeholder="Search by name or code..."
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[900px]">
          <thead className="sticky top-0 bg-slate-50 dark:bg-[#142119] z-10 shadow-sm border-b border-slate-200 dark:border-[#2d4a35]">
            <tr className="text-[11px] font-bold text-slate-500 dark:text-[#64916e] uppercase tracking-wider">
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
          <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
            {filteredProducts
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors group">
                  <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-[#a7c4ae]">{product.code}</td>
                  <td className="px-4 py-3 max-w-[240px]">
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-slate-800 dark:text-[#e2f5e8] truncate" title={product.name}>{product.name}</span>
                      {product.description && (
                        <span className="text-xs text-slate-500 dark:text-[#64916e] truncate" title={product.description}>{product.description}</span>
                      )}
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {product.tags.map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">{product.category}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-[#e2f5e8]">
                    {product.stock.toFixed(2)} {product.unit}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-[#e2f5e8]">{formatCurrency(product.sellPrice)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-500 dark:text-[#64916e]">{formatCurrency(product.cost)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 dark:bg-[#1e3124] text-slate-600 dark:text-[#a7c4ae]">
                      {product.tax}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${
                      product.status === 'In Stock'
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : product.status === 'Warning: Low'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400'
                    }`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onAddStockClick(product.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded" title="Adjust Stock">
                        <PlusCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => onEditClick(product)} className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {product.isLocked ? (
                        <button className="p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-[#223927] rounded cursor-not-allowed" title="Locked — cannot delete">
                          <Lock className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => onDeleteClick(product)} className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded" title="Delete Product">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  {products.length === 0 ? "Loading core products..." : "No products found matching your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredProducts.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filteredProducts.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemLabel="products"
        />
      )}
    </div>
  );
};