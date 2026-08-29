import React from 'react';
import { useExpenseStore } from '../../store/expenseStore';

export const ExpenseSummary: React.FC = () => {
  const { summary, expenses } = useExpenseStore();

  const formatCurrency = (val: number) =>
    `Rs. ${val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const total = summary.netExpense || expenses.reduce((s, e) => s + (e.amount || e.netExpense || 0), 0);
  const paid =
    summary.paid ?? expenses.reduce((s, e) => s + (e.paidAmount || 0), 0);
  const remaining =
    summary.remaining ??
    expenses.reduce(
      (s, e) =>
        s + (e.remaining ?? Math.max(0, (e.amount || e.netExpense || 0) - (e.paidAmount || 0))),
      0
    );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 mb-1">Total expenses</p>
        <p className="text-lg font-bold text-slate-800">{formatCurrency(total)}</p>
      </div>

      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-emerald-700 mb-1">Paid (cash out)</p>
        <p className="text-lg font-bold text-emerald-800">{formatCurrency(paid)}</p>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 shadow-sm col-span-2 md:col-span-1">
        <p className="text-xs font-semibold text-amber-700 mb-1">Remaining to clear</p>
        <p className="text-lg font-bold text-amber-800">{formatCurrency(remaining)}</p>
      </div>
    </div>
  );
};
