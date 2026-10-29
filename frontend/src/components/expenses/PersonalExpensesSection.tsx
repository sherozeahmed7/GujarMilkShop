import React, { useState, useEffect, useMemo } from 'react';
import { ExpenseRecord } from '../../types/expense';
import { getExpenses, deleteExpense } from '../../services/expenseService';
import { SummaryCard } from '../reports/SummaryCard';
import { Pagination } from '../common/Pagination';
import { PersonalCashReceiveModal } from './PersonalCashReceiveModal';
import { AddPersonalExpenseModal } from './AddPersonalExpenseModal';
import {
  Wallet, DollarSign, Scale, FileText, Plus,
  Calendar, Search, RefreshCw, Trash2, ArrowDownLeft
} from 'lucide-react';

function fmt(n: number): string {
  if (isNaN(n) || !isFinite(n)) return 'Rs. 0';
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

const DATE_PRESETS = [
  'Today', 'Yesterday', 'This Week', 'This Month', 'Last Month', 'This Year', 'All Time'
] as const;

function getStatus(expense: ExpenseRecord): 'Unpaid' | 'Partial' | 'Paid' {
  const amount = Number(expense.amount || 0);
  const paid = Number(expense.paidAmount || 0);
  const remaining = Math.max(0, amount - paid);
  if (remaining <= 0) return 'Paid';
  if (paid > 0) return 'Partial';
  return 'Unpaid';
}

const STATUS_BADGE: Record<string, string> = {
  Unpaid: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/40',
  Partial: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/40',
  Paid:    'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/40',
};

export const PersonalExpensesSection: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState<string>('All Time');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [receiveExpense, setReceiveExpense] = useState<ExpenseRecord | null>(null);

  // Compute filter dates using local calendar (avoid UTC day shifts)
  const dateRange = useMemo(() => {
    const toYMD = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const now = new Date();
    const todayStr = toYMD(now);

    if (activeFilter === 'Today') return { from: todayStr, to: todayStr };
    if (activeFilter === 'Yesterday') {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const yStr = toYMD(y);
      return { from: yStr, to: yStr };
    }
    if (activeFilter === 'This Week') {
      const start = new Date(now); 
      const dow = start.getDay();
      start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1)); // Monday start
      return { from: toYMD(start), to: todayStr };
    }
    if (activeFilter === 'This Month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toYMD(start), to: todayStr };
    }
    if (activeFilter === 'Last Month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toYMD(start), to: toYMD(end) };
    }
    if (activeFilter === 'This Year') {
      const start = new Date(now.getFullYear(), 0, 1);
      return { from: toYMD(start), to: todayStr };
    }
    if (activeFilter === 'Custom' && (customFrom || customTo)) {
      return { from: customFrom || undefined, to: customTo || undefined };
    }
    return { from: undefined, to: undefined };
  }, [activeFilter, customFrom, customTo]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getExpenses({
        fromDate: dateRange.from,
        toDate: dateRange.to,
        expenseType: 'PERSONAL',
      });
      setExpenses(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load personal expenses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    setCurrentPage(1);
  }, [dateRange.from, dateRange.to]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this personal expense?')) return;
    try {
      await deleteExpense(id);
      loadData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete entry');
    }
  };

  // Filter by search query and sort (latest first for display)
  const filtered = useMemo(() => {
    let list = expenses;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q) ||
          e.reason?.toLowerCase().includes(q) ||
          e.addedBy?.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => {
      if (b.date === a.date) return Number(b.id) - Number(a.id);
      return b.date.localeCompare(a.date);
    });
  }, [expenses, searchQuery]);

  // Summary totals from the full date-filtered dataset (not just current page)
  const totalPersonalExpense = useMemo(
    () => expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0),
    [expenses]
  );
  const totalCashReceived = useMemo(
    () => expenses.reduce((s, e) => s + (Number(e.paidAmount) || 0), 0),
    [expenses]
  );
  const remainingBalance = useMemo(
    () => Math.max(0, totalPersonalExpense - totalCashReceived),
    [totalPersonalExpense, totalCashReceived]
  );

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, currentPage, itemsPerPage]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Total Personal Expense"
          value={fmt(totalPersonalExpense)}
          icon={Wallet}
          valueColor="text-rose-600 dark:text-rose-400"
        />
        <SummaryCard
          title="Total Cash Received"
          value={fmt(totalCashReceived)}
          icon={DollarSign}
          valueColor="text-emerald-600 dark:text-emerald-400"
        />
        <SummaryCard
          title="Remaining Balance"
          value={fmt(remainingBalance)}
          icon={Scale}
          valueColor={remainingBalance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-300'}
        />
        <SummaryCard
          title="Personal Expense Entries"
          value={String(expenses.length)}
          icon={FileText}
          valueColor="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* ── Action Toolbar: Filters + Add button ── */}
      <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Preset filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset}
              onClick={() => setActiveFilter(preset)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                activeFilter === preset
                  ? 'bg-emerald-600 dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-sm'
                  : 'bg-slate-100 dark:bg-[#142119] text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-200 dark:hover:bg-[#1e3424]'
              }`}
            >
              {preset}
            </button>
          ))}
          <button
            onClick={() => setActiveFilter(activeFilter === 'Custom' ? 'All Time' : 'Custom')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
              activeFilter === 'Custom'
                ? 'bg-emerald-600 dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-sm'
                : 'bg-slate-100 dark:bg-[#142119] text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-200 dark:hover:bg-[#1e3424]'
            }`}
          >
            Custom
          </button>
        </div>

        {/* Add + Refresh buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 bg-emerald-600 dark:bg-[#22c55e] hover:bg-emerald-700 dark:hover:bg-[#1ea34d] text-white dark:text-[#0d1a10] font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Personal Expense
          </button>
          <button
            onClick={loadData}
            title="Refresh"
            className="p-2 border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124] rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Custom date range picker */}
      {activeFilter === 'Custom' && (
        <div className="bg-white dark:bg-[#1a2e1f] rounded-xl border border-slate-200 dark:border-[#2d4a35] p-3 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">From:</span>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg"
          />
          <span className="text-xs font-semibold text-slate-500 dark:text-[#8ba895]">To:</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg"
          />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center justify-between gap-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 rounded-xl px-4 py-3 text-sm font-medium">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 font-bold">✕</button>
        </div>
      )}

      {/* ── Search ── */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by description, notes, or entered by…"
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
          className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#22c55e] shadow-sm"
        />
      </div>

      {/* ── Ledger Table ── */}
      <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-[#2d4a35] flex justify-between items-center bg-slate-50 dark:bg-[#142119]">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-sm">Personal Expense Ledger</h3>
            <p className="text-xs text-slate-500 dark:text-[#8ba895] mt-0.5">
              {activeFilter} · {filtered.length} record{filtered.length === 1 ? '' : 's'}
            </p>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
            {filtered.length} Entr{filtered.length === 1 ? 'y' : 'ies'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50 dark:bg-[#142119] border-b border-slate-200 dark:border-[#2d4a35]">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Date</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">Expense</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">Received</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-right">Remaining</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Notes</th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 dark:text-[#64916e] text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-emerald-500 dark:border-[#22c55e] border-t-transparent rounded-full animate-spin" />
                      Loading…
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 dark:text-[#64916e] text-sm">
                    No personal expenses recorded for this period.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const expAmt = Number(row.amount || 0);
                  const recAmt = Number(row.paidAmount || 0);
                  const remAmt = Math.max(0, expAmt - recAmt);
                  const status = getStatus(row);

                  return (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae] whitespace-nowrap font-mono">
                        {row.date}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-800 dark:text-[#e2f5e8]">
                        <div>{row.description || row.category || '—'}</div>
                        {row.category && row.category !== (row.description) && row.category !== 'Personal' && (
                          <span className="text-[11px] text-slate-400 dark:text-[#64916e] font-normal">{row.category}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-rose-600 dark:text-rose-400 tabular-nums whitespace-nowrap">
                        {expAmt > 0 ? fmt(expAmt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-emerald-600 dark:text-emerald-400 tabular-nums whitespace-nowrap">
                        {recAmt > 0 ? fmt(recAmt) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold tabular-nums whitespace-nowrap">
                        {remAmt > 0
                          ? <span className="text-amber-600 dark:text-amber-400">{fmt(remAmt)}</span>
                          : <span className="text-slate-400 dark:text-slate-500">{fmt(0)}</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${STATUS_BADGE[status]}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 dark:text-[#8ba895] max-w-[160px] truncate">
                        {row.reason || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* Receive Cash — always visible */}
                          <button
                            onClick={() => setReceiveExpense(row)}
                            title="Receive Cash"
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/40 rounded-lg transition-colors"
                          >
                            <ArrowDownLeft className="w-3 h-3" />
                            Receive Cash
                          </button>
                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(row.id)}
                            title="Delete"
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Totals Footer */}
            {filtered.length > 0 && !loading && (
              <tfoot className="bg-slate-100 dark:bg-[#111e14] border-t-2 border-slate-300 dark:border-[#2d4a35] font-bold">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-xs font-bold uppercase text-slate-700 dark:text-[#a7c4ae]">
                    Totals ({filtered.length} Records)
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-rose-700 dark:text-rose-400 text-right tabular-nums">
                    {fmt(totalPersonalExpense)}
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-700 dark:text-emerald-400 text-right tabular-nums">
                    {fmt(totalCashReceived)}
                  </td>
                  <td className="px-4 py-3 text-sm font-black text-emerald-700 dark:text-emerald-300 text-right tabular-nums">
                    {fmt(remainingBalance)}
                  </td>
                  <td colSpan={3} className="px-4 py-3 text-xs text-slate-500 dark:text-[#8ba895]">
                    Net Outstanding Balance
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {filtered.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filtered.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            itemLabel="entries"
          />
        )}
      </div>

      {/* Modals */}
      {isAddOpen && (
        <AddPersonalExpenseModal
          onClose={() => setIsAddOpen(false)}
          onSuccess={loadData}
        />
      )}
      {receiveExpense && (
        <PersonalCashReceiveModal
          expense={receiveExpense}
          onClose={() => setReceiveExpense(null)}
          onSuccess={() => { setReceiveExpense(null); loadData(); }}
        />
      )}
    </div>
  );
};
