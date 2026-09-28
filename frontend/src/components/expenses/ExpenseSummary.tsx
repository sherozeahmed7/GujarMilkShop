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
      <div className="bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Total expenses</p>
        <p className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">{formatCurrency(total)}</p>
      </div>

      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/50 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Paid (cash out)</p>
        <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{formatCurrency(paid)}</p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/50 rounded-xl p-4 shadow-sm col-span-2 md:col-span-1">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">Remaining to clear</p>
        <p className="text-lg font-bold text-amber-800 dark:text-amber-300">{formatCurrency(remaining)}</p>
      </div>
    </div>
  );
};
