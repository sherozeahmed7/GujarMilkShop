import React, { useState, useMemo } from 'react';
import { useExpenseStore } from '../../store/expenseStore';
import { ExpenseRecord } from '../../types';
import { Eye, Edit2, Trash2, FileText, Search } from 'lucide-react';
import { ExpenseModals } from './ExpenseModals';

type FilterTab = 'Today' | 'This Week' | 'This Month' | 'All Time';

function money(n: number) {
  return Math.round(n || 0).toLocaleString();
}

export const ExpenseHistory: React.FC = () => {
  const { expenses, isLoading } = useExpenseStore();

  const [activeTab, setActiveTab] = useState<FilterTab>('Today');
  const [searchQuery, setSearchQuery] = useState('');

  const [viewExpense, setViewExpense] = useState<ExpenseRecord | null>(null);
  const [editExpense, setEditExpense] = useState<ExpenseRecord | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [payExpense, setPayExpense] = useState<ExpenseRecord | null>(null);

  const filteredExpenses = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filtered = expenses;

    if (activeTab === 'Today') {
      filtered = filtered.filter((e) => new Date(e.date) >= today);
    } else if (activeTab === 'This Week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter((e) => new Date(e.date) >= weekAgo);
    } else if (activeTab === 'This Month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter((e) => new Date(e.date) >= monthAgo);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.category.toLowerCase().includes(q) ||
          (e.description && e.description.toLowerCase().includes(q)) ||
          (e.reason && e.reason.toLowerCase().includes(q)) ||
          e.addedBy.toLowerCase().includes(q)
      );
    }

    return filtered;
  }, [expenses, activeTab, searchQuery]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col mt-6 h-[440px]">
      <div className="border-b border-slate-200 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex space-x-1 overflow-x-auto custom-scrollbar">
          {(['Today', 'This Week', 'This Month', 'All Time'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-64"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center items-center h-full text-slate-500 text-sm">
            Loading expenses...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-slate-500 py-10">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-600">No expenses found</p>
            <p className="text-sm mt-1">Add an expense above or change the filter.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  Date
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  Product
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  Notes
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-right">
                  Total
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-right">
                  Paid
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200 text-right">
                  Remaining
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  Added By
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((expense) => {
                const total = expense.amount ?? expense.netExpense ?? 0;
                const paid = expense.paidAmount ?? 0;
                const remaining =
                  expense.remaining ?? Math.max(0, total - paid);
                return (
                  <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[180px] truncate">
                      {expense.reason || expense.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap text-right tabular-nums">
                      Rs. {money(total)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700 whitespace-nowrap text-right tabular-nums">
                      Rs. {money(paid)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap text-right tabular-nums">
                      {remaining > 0 ? (
                        <span className="text-amber-600">Rs. {money(remaining)}</span>
                      ) : (
                        <span className="text-slate-400">Rs. 0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {expense.addedBy}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setViewExpense(expense)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditExpense(expense)}
                          className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                          title="Edit Expense"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteExpenseId(expense.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ExpenseModals
        viewExpense={viewExpense}
        onCloseView={() => setViewExpense(null)}
        editExpense={editExpense}
        onCloseEdit={() => setEditExpense(null)}
        deleteExpenseId={deleteExpenseId}
        onCloseDelete={() => setDeleteExpenseId(null)}
        payExpense={payExpense}
        onClosePay={() => setPayExpense(null)}
      />
    </div>
  );
};
