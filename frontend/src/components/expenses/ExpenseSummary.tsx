import React from 'react';
import { useExpenseStore } from '../../store/expenseStore';

export const ExpenseSummary: React.FC = () => {
  const { summary } = useExpenseStore();
  const formatCurrency = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="font-bold text-slate-800 mb-4">Expense Summary</h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Gross</p>
          <p className="text-lg font-bold text-slate-800">{formatCurrency(summary.grossLoss)}</p>
        </div>
        <div className="bg-rose-50 rounded-lg p-3 border border-rose-100">
          <p className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Net Expense</p>
          <p className="text-lg font-bold text-rose-600">{formatCurrency(summary.netExpense)}</p>
        </div>
      </div>
    </div>
  );
};
