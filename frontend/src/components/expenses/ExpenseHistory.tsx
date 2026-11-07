import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useExpenseStore } from '../../store/expenseStore';
import { ExpenseRecord } from '../../types';
import { Eye, Edit2, Trash2, FileText, Search, CreditCard, MoreVertical } from 'lucide-react';
import { ExpenseModals } from './ExpenseModals';
import { Pagination } from '../common/Pagination';
import { formatUserName } from '../../utils/userFormat';

type FilterTab = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'All Time';

function money(n: number) {
  return Math.round(n || 0).toLocaleString();
}

export const ExpenseHistory: React.FC = () => {
  const { expenses, isLoading, filterTab, setFilterTab } = useExpenseStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [viewExpense, setViewExpense] = useState<ExpenseRecord | null>(null);
  const [editExpense, setEditExpense] = useState<ExpenseRecord | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);
  const [payExpense, setPayExpense] = useState<ExpenseRecord | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setOpenActionId(null);
      }
    };
    if (openActionId) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [openActionId]);

  const filteredExpenses = useMemo(() => {
    const toYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const now = new Date();
    const todayStr = toYMD(now);

    let filtered = expenses;

    if (filterTab === 'Today') {
      filtered = filtered.filter((e) => e.date === todayStr);
    } else if (filterTab === 'Yesterday') {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yStr = toYMD(y);
      filtered = filtered.filter((e) => e.date === yStr);
    } else if (filterTab === 'This Week') {
      const start = new Date(now);
      const dow = start.getDay();
      start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday
      const startStr = toYMD(start);
      filtered = filtered.filter((e) => e.date >= startStr && e.date <= todayStr);
    } else if (filterTab === 'This Month') {
      const startStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      filtered = filtered.filter((e) => e.date >= startStr && e.date <= todayStr);
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
  }, [expenses, filterTab, searchQuery]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [filterTab, searchQuery]);

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden flex flex-col mt-6">
      <div className="border-b border-slate-200 dark:border-[#2d4a35] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex space-x-1 overflow-x-auto custom-scrollbar">
          {(['Today', 'Yesterday', 'This Week', 'This Month', 'All Time'] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilterTab(tab)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                filterTab === tab
                  ? 'bg-slate-800 dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#223927]'
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
            className="pl-9 pr-4 py-1.5 text-sm border border-slate-200 dark:border-[#2d4a35] rounded-full bg-white dark:bg-[#142119] text-slate-700 dark:text-[#e2f5e8] placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#22c55e] w-full sm:w-64"
          />
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center items-center py-12 text-slate-500 text-sm">
            Loading expenses...
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="flex flex-col justify-center items-center text-slate-500 py-10">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <p className="font-semibold text-slate-600">No expenses found</p>
            <p className="text-sm mt-1">Add an expense above or change the filter.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-[#2d4a35]">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-[#2d4a35]">Product</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-[#2d4a35]">Notes</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-[#2d4a35] text-right">Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-[#2d4a35] text-right">Paid</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-[#2d4a35] text-right">Remaining</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-[#2d4a35]">Added By</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-[#2d4a35]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
              {filteredExpenses
                .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                .map((expense) => {
                const total = expense.amount ?? expense.netExpense ?? 0;
                const paid = expense.paidAmount ?? 0;
                const remaining =
                  expense.remaining ?? Math.max(0, total - paid);
                return (
                  <tr key={expense.id} className="hover:bg-slate-50 dark:hover:bg-[#223927] transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {new Date(expense.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8]">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-[180px] truncate">
                      {expense.reason || expense.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-[#e2f5e8] whitespace-nowrap text-right tabular-nums">
                      Rs. {money(total)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap text-right tabular-nums">
                      Rs. {money(paid)}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold whitespace-nowrap text-right tabular-nums">
                      {remaining > 0 ? (
                        <span className="text-amber-600 dark:text-amber-400">Rs. {money(remaining)}</span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500">Rs. 0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatUserName(expense.addedBy)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {remaining > 0 && (
                          <button
                            onClick={() => setPayExpense(expense)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 rounded-lg transition-colors shadow-2xs"
                            title="Pay remaining expense balance"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Pay Now</span>
                          </button>
                        )}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionId(openActionId === expense.id ? null : expense.id);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              openActionId === expense.id
                                ? 'bg-slate-200 text-slate-800 dark:bg-[#223927] dark:text-[#e2f5e8]'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-[#223927] dark:hover:text-slate-200'
                            }`}
                            title="More actions"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openActionId === expense.id && (
                            <div
                              ref={actionMenuRef}
                              className="absolute right-0 mt-1 w-40 bg-white dark:bg-[#1a2e1f] rounded-xl shadow-lg border border-slate-200 dark:border-[#2d4a35] py-1 z-30 animate-in fade-in zoom-in-95 duration-100"
                            >
                              <button
                                onClick={() => {
                                  setViewExpense(expense);
                                  setOpenActionId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#223927] transition-colors"
                              >
                                <Eye className="w-3.5 h-3.5 text-blue-500" />
                                <span>View Details</span>
                              </button>
                              <button
                                onClick={() => {
                                  setEditExpense(expense);
                                  setOpenActionId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#223927] transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-emerald-500" />
                                <span>Edit Expense</span>
                              </button>
                              <button
                                onClick={() => {
                                  setDeleteExpenseId(expense.id);
                                  setOpenActionId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors border-t border-slate-100 dark:border-[#2d4a35]/60"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                <span>Delete Expense</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {!isLoading && filteredExpenses.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filteredExpenses.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemLabel="expenses"
        />
      )}

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
