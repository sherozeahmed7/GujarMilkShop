import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { StockMovement, Product } from '../../types/inventory';

interface StockMovementsTabProps {
  movements: StockMovement[];
  products: Product[];
}

export const StockMovementsTab: React.FC<StockMovementsTabProps> = ({ movements, products }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filteredMovements = movements.filter(m => {
    const product = products.find(p => p.id === m.productId);
    const searchString = `${m.reference} ${product?.name} ${product?.code}`.toLowerCase();
    const matchesSearch = searchString.includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || m.movementType === typeFilter;
    return matchesSearch && matchesType;
  });

  const formatDate = (isoString: string) => new Date(isoString).toLocaleDateString() + ' ' + new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Extract unique movement types
  const movementTypes = Array.from(new Set(movements.map(m => m.movementType)));

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
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" 
            placeholder="Search product or reference..." 
          />
        </div>
        <select 
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:w-48"
        >
          <option value="ALL">All Types</option>
          {movementTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm border-b border-slate-200">
            <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3 text-right">Qty Change</th>
              <th className="px-4 py-3 text-right">Prev Stock</th>
              <th className="px-4 py-3 text-right">New Stock</th>
              <th className="px-4 py-3">Reference / Notes</th>
              <th className="px-4 py-3">User</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredMovements.map((movement) => {
              const product = products.find(p => p.id === movement.productId);
              const isPositive = movement.quantity > 0;
              const isNegative = movement.quantity < 0;
              
              return (
                <tr key={movement.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(movement.date)}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-slate-700">{product?.name || 'Unknown'}</div>
                    <div className="text-xs text-slate-500">{product?.code || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-600">
                      {movement.movementType}
                    </span>
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold text-right ${isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-600'}`}>
                    {isPositive ? '+' : ''}{movement.quantity} {product?.unit}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 text-right">{movement.previousStock}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800 text-right">{movement.newStock}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-[200px] truncate" title={movement.notes || movement.reference}>
                    {movement.notes || movement.reference}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{movement.user}</td>
                </tr>
              );
            })}
            {filteredMovements.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 text-sm">
                  {movements.length === 0 ? "No stock movements recorded yet." : "No movements matching your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
