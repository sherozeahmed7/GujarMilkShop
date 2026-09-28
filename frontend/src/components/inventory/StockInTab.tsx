import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { StockIn, Product } from '../../types/inventory';
import { Pagination } from '../common/Pagination';

interface StockInTabProps {
  stockInRecords: StockIn[];
  products: Product[];
}

export const StockInTab: React.FC<StockInTabProps> = ({ stockInRecords, products }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredRecords = stockInRecords.filter(record => {
    const product = products.find(p => p.id === record.productId);
    const searchString = `${record.reference} ${record.supplier} ${product?.name} ${product?.code}`.toLowerCase();
    return searchString.includes(searchQuery.toLowerCase());
  });

  const formatCurrency = (n: number) => `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const formatDate = (isoString: string) => new Date(isoString).toLocaleDateString() + ' ' + new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-[#1a2e1f]">
      {/* Header / Actions */}
      <div className="p-4 border-b border-slate-200 dark:border-[#2d4a35] flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#64916e]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Search reference, product, supplier..."
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-slate-50 dark:bg-[#142119] z-10 shadow-sm border-b border-slate-200 dark:border-[#2d4a35]">
            <tr className="text-[11px] font-bold text-slate-500 dark:text-[#64916e] uppercase tracking-wider">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Quantity</th>
              <th className="px-4 py-3">Unit Cost</th>
              <th className="px-4 py-3">Total Cost</th>
              <th className="px-4 py-3">Supplier</th>
              <th className="px-4 py-3">User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
            {filteredRecords
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((record) => {
                const product = products.find(p => p.id === record.productId);
                return (
                  <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-[#223927] transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(record.date)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-[#e2f5e8]">{record.reference}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-slate-700 dark:text-[#e2f5e8]">{product?.name || 'Unknown'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{product?.code || ''}</div>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-[#e2f5e8]">
                      +{record.quantity} {product?.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{formatCurrency(record.unitCost)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 dark:text-[#e2f5e8]">{formatCurrency(record.totalCost)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{record.supplier}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{record.addedBy}</td>
                  </tr>
                );
              })}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  {stockInRecords.length === 0 ? "No stock-in records found." : "No records matching your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredRecords.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filteredRecords.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemLabel="records"
        />
      )}
    </div>
  );
};
