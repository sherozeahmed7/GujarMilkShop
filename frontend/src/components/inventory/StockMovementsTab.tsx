import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { StockMovement, Product } from '../../types/inventory';
import { Pagination } from '../common/Pagination';

interface StockMovementsTabProps {
  movements: StockMovement[];
  products: Product[];
}

export const StockMovementsTab: React.FC<StockMovementsTabProps> = ({ movements, products }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, typeFilter]);

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
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-[#1a2e1f]">
      {/* Filters */}
      <div className="p-4 border-b border-slate-200 dark:border-[#2d4a35] flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#64916e]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Search product or reference..."
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:w-48"
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
          <thead className="sticky top-0 bg-slate-50 dark:bg-[#142119] z-10 shadow-sm border-b border-slate-200 dark:border-[#2d4a35]">
            <tr className="text-[11px] font-bold text-slate-500 dark:text-[#64916e] uppercase tracking-wider">
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
          <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
            {filteredMovements
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((movement) => {
                const product = products.find(p => p.id === movement.productId);
                const isPositive = movement.quantity > 0;
                const isNegative = movement.quantity < 0;

                return (
                  <tr key={movement.id} className="hover:bg-slate-50 dark:hover:bg-[#223927] transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatDate(movement.date)}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-bold text-slate-700 dark:text-[#e2f5e8]">{product?.name || 'Unknown'}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{product?.code || ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 dark:bg-[#142119] text-slate-600 dark:text-slate-300">
                        {movement.movementType}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm font-bold text-right ${isPositive ? 'text-emerald-600 dark:text-emerald-400' : isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                      {isPositive ? '+' : ''}{movement.quantity} {product?.unit}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 text-right">{movement.previousStock}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-[#e2f5e8] text-right">{movement.newStock}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-[200px] truncate" title={movement.notes || movement.reference}>
                      {movement.notes || movement.reference}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">{movement.user}</td>
                  </tr>
                );
              })}
            {filteredMovements.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                  {movements.length === 0 ? "No stock movements recorded yet." : "No movements matching your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {filteredMovements.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filteredMovements.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemLabel="movements"
        />
      )}
    </div>
  );
};
