import React from 'react';
import { useExpenseStore } from '../../store/expenseStore';

export const ExpenseSummary: React.FC = () => {
  const { summary } = useExpenseStore();

  const formatCurrency = (val: number) => `Rs. ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 mb-1">Stock</p>
        <p className="text-lg font-bold text-slate-800">{summary.stock.toFixed(2)} kg</p>
      </div>
      
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 mb-1">Avg Cost</p>
        <p className="text-lg font-bold text-slate-800">{formatCurrency(summary.avgCost)}/kg</p>
      </div>
      
      <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-rose-600 mb-1">Gross Loss</p>
        <p className="text-lg font-bold text-rose-700">{formatCurrency(summary.grossLoss)}</p>
      </div>
      
      <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-rose-600 mb-1">Net Expense</p>
        <p className="text-lg font-bold text-rose-700">{formatCurrency(summary.netExpense)}</p>
      </div>
    </div>
  );
};
