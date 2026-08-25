import React, { useState } from 'react';
import { Search, Plus } from 'lucide-react';
import { StockIn, Product } from '../../types/inventory';

interface StockInTabProps {
  stockInRecords: StockIn[];
  products: Product[];
  onAddStockInClick: () => void;
}

export const StockInTab: React.FC<StockInTabProps> = ({ stockInRecords, products, onAddStockInClick }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecords = stockInRecords.filter(record => {
    const product = products.find(p => p.id === record.productId);
    const searchString = `${record.reference} ${record.supplier} ${product?.name} ${product?.code}`.toLowerCase();
    return searchString.includes(searchQuery.toLowerCase());
  });

  const formatCurrency = (n: number) => `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const formatDate = (isoString: string) => new Date(isoString).toLocaleDateString() + ' ' + new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header / Actions */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
            placeholder="Search reference, product, supplier..." 
          />
        </div>
        <button 
          onClick={onAddStockInClick}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-sm font-medium text-white hover:bg-blue-700 transition-colors shadow-sm w-full sm:w-auto justify-center"
        >
          <Plus className="w-4 h-4" /> Receive Stock
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm border-b border-slate-200">
            <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
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
          <tbody className="divide-y divide-slate-100">
            {filteredRecords.map((record) => {
              const product = products.find(p => p.id === record.productId);
              return (
                <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(record.date)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{record.reference}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-slate-700">{product?.name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{product?.code || ''}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                    +{record.quantity} {product?.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatCurrency(record.unitCost)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{formatCurrency(record.totalCost)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{record.supplier}</td>
                  <td className="px-4 py-3 text-sm text-slate-500">{record.addedBy}</td>
                </tr>
              );
            })}
            {filteredRecords.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">
                  {stockInRecords.length === 0 ? "No stock-in records found." : "No records matching your search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
