import React, { useMemo } from 'react';
import { useExpenseStore } from '../../store/expenseStore';

export const ExpenseSummary: React.FC = () => {
  const { expenses, filterTab } = useExpenseStore();

  const formatCurrency = (val: number) =>
    `Rs. ${Math.round(val || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const filteredExpenses = useMemo(() => {
    const toYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const now = new Date();
    const todayStr = toYMD(now);

    if (filterTab === 'Today') {
      return expenses.filter((e) => e.date === todayStr);
    }
    if (filterTab === 'Yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toYMD(y);
      return expenses.filter((e) => e.date === yStr);
    }
    if (filterTab === 'This Week') {
      const start = new Date(now);
      const dow = start.getDay();
      start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday
      const startStr = toYMD(start);
      return expenses.filter((e) => e.date >= startStr && e.date <= todayStr);
    }
    if (filterTab === 'This Month') {
      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      return expenses.filter((e) => e.date >= startStr && e.date <= todayStr);
    }
    // All Time
    return expenses;
  }, [expenses, filterTab]);

  const total = useMemo(
    () => filteredExpenses.reduce((s, e) => s + (Number(e.amount) || Number(e.netExpense) || 0), 0),
    [filteredExpenses]
  );
  const paid = useMemo(
    () => filteredExpenses.reduce((s, e) => s + (Number(e.paidAmount) || 0), 0),
    [filteredExpenses]
  );
  const remaining = useMemo(
    () => Math.max(0, total - paid),
    [total, paid]
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
      <div className="bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
          Total expenses ({filterTab})
        </p>
        <p className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">{formatCurrency(total)}</p>
      </div>

      <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/50 rounded-xl p-4 shadow-sm">
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">
          Paid (cash out) ({filterTab})
        </p>
        <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">{formatCurrency(paid)}</p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/50 rounded-xl p-4 shadow-sm col-span-2 md:col-span-1">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1">
          Remaining to clear ({filterTab})
        </p>
        <p className="text-lg font-bold text-amber-800 dark:text-amber-300">{formatCurrency(remaining)}</p>
      </div>
    </div>
  );
};
