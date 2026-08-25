import React from 'react';
import { Package, TrendingUp, Filter } from 'lucide-react';
import { InventorySummary } from '../../types/inventory';

interface InventorySummaryCardsProps {
  summary: InventorySummary;
}

export const InventorySummaryCards: React.FC<InventorySummaryCardsProps> = ({ summary }) => {
  const formatCurrency = (n: number) => `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
          <Package className="w-4 h-4 text-slate-400" /> Products
        </div>
        <div className="text-2xl font-bold text-slate-800">{summary.totalProducts}</div>
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
          <TrendingUp className="w-4 h-4 text-emerald-500" /> Stock Value
        </div>
        <div className="text-2xl font-bold text-slate-800">{formatCurrency(summary.stockValue)}</div>
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
          <Filter className="w-4 h-4 text-amber-500" /> Low Stock
        </div>
        <div className="text-2xl font-bold text-slate-800">{summary.lowStockCount}</div>
      </div>
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
          <Package className="w-4 h-4 text-rose-500" /> Out of Stock
        </div>
        <div className="text-2xl font-bold text-slate-800">{summary.outOfStockCount}</div>
      </div>
    </div>
  );
};
