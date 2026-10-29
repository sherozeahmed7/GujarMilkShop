import React, { useState } from 'react';
import { X, DollarSign, Calendar, FileText, AlertCircle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { recordPersonalReceiveForExpense, recordPersonalReturnForExpense } from '../../services/expenseService';
import { ExpenseRecord } from '../../types/expense';

interface PersonalCashReceiveModalProps {
  expense: ExpenseRecord;
  onClose: () => void;
  onSuccess: () => void;
}

function fmt(n: number): string {
  if (isNaN(n) || !isFinite(n)) return 'Rs. 0';
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

type Tab = 'receive' | 'return';

export const PersonalCashReceiveModal: React.FC<PersonalCashReceiveModalProps> = ({
  expense,
  onClose,
  onSuccess,
}) => {
  const expenseAmount = Number(expense.amount || 0);
  const alreadyPaid = Number(expense.paidAmount || 0);
  const remaining = Math.max(0, expenseAmount - alreadyPaid);

  const [tab, setTab] = useState<Tab>('receive');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedAmt = Number(amount);

  // Receive tab validation
  const isOverReceive = tab === 'receive' && Number.isFinite(parsedAmt) && parsedAmt > remaining;
  const isReceiveValid =
    tab === 'receive' &&
    amount.trim() !== '' &&
    Number.isFinite(parsedAmt) &&
    parsedAmt > 0 &&
    parsedAmt <= remaining;

  // Return tab validation — can only return what was already received
  const isOverReturn = tab === 'return' && Number.isFinite(parsedAmt) && parsedAmt > alreadyPaid;
  const isReturnValid =
    tab === 'return' &&
    amount.trim() !== '' &&
    Number.isFinite(parsedAmt) &&
    parsedAmt > 0 &&
    parsedAmt <= alreadyPaid;

  const isValid = tab === 'receive' ? isReceiveValid : isReturnValid;
  const isOver = tab === 'receive' ? isOverReceive : isOverReturn;
  const maxAmt = tab === 'receive' ? remaining : alreadyPaid;

  const switchTab = (t: Tab) => {
    setTab(t);
    setAmount('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
      setError('Please enter a valid amount greater than zero.');
      return;
    }

    if (tab === 'receive') {
      if (parsedAmt > remaining) {
        setError(`Amount cannot exceed remaining balance of ${fmt(remaining)}.`);
        return;
      }
      setLoading(true);
      try {
        await recordPersonalReceiveForExpense(expense.id, {
          amount: parsedAmt,
          date,
          notes: notes.trim() || undefined,
        });
        onSuccess();
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Failed to record cash received.');
      } finally {
        setLoading(false);
      }
    } else {
      if (parsedAmt > alreadyPaid) {
        setError(`Return amount cannot exceed cash already received (${fmt(alreadyPaid)}).`);
        return;
      }
      setLoading(true);
      try {
        await recordPersonalReturnForExpense(expense.id, {
          amount: parsedAmt,
          date,
          notes: notes.trim() || undefined,
        });
        onSuccess();
        onClose();
      } catch (err: any) {
        setError(err?.message || 'Failed to record cash return.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-[#2d4a35] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex justify-between items-center bg-slate-50 dark:bg-[#142119]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-base">Cash Settlement</h3>
              <p className="text-xs text-slate-500 dark:text-[#8ba895]">Personal expense settlement</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#e2f5e8] hover:bg-slate-100 dark:hover:bg-[#1e3124] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Expense Summary Block */}
        <div className="px-6 pt-4 pb-0">
          <div className="bg-slate-50 dark:bg-[#142119] rounded-xl border border-slate-200 dark:border-[#2d4a35] p-4 space-y-2">
            <p className="text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Expense Details</p>
            <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">
              {expense.description || expense.category || '—'}
            </p>
            <p className="text-xs text-slate-500 dark:text-[#8ba895]">Date: {expense.date}</p>
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="text-center">
                <p className="text-[11px] text-slate-400 dark:text-[#64916e] uppercase font-semibold">Original</p>
                <p className="text-sm font-bold text-slate-700 dark:text-[#a7c4ae]">{fmt(expenseAmount)}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-slate-400 dark:text-[#64916e] uppercase font-semibold">Received</p>
                <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{fmt(alreadyPaid)}</p>
              </div>
              <div className="text-center">
                <p className="text-[11px] text-slate-400 dark:text-[#64916e] uppercase font-semibold">Remaining</p>
                <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{fmt(remaining)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-4">
          <div className="flex gap-1.5 p-1 bg-slate-100 dark:bg-[#142119] rounded-xl border border-slate-200 dark:border-[#2d4a35]">
            <button
              type="button"
              onClick={() => switchTab('receive')}
              disabled={remaining <= 0}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                tab === 'receive'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : remaining <= 0
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-600 dark:text-[#8ba895] hover:bg-white dark:hover:bg-[#1e3124]'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              Receive Cash
              {remaining <= 0 && <span className="text-[10px] opacity-60 ml-0.5">(fully paid)</span>}
            </button>
            <button
              type="button"
              onClick={() => switchTab('return')}
              disabled={alreadyPaid <= 0}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                tab === 'return'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : alreadyPaid <= 0
                  ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                  : 'text-slate-600 dark:text-[#8ba895] hover:bg-white dark:hover:bg-[#1e3124]'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Return Cash
              {alreadyPaid <= 0 && <span className="text-[10px] opacity-60 ml-0.5">(none received)</span>}
            </button>
          </div>

          {/* Tab description */}
          <p className="text-[11px] text-slate-500 dark:text-[#8ba895] mt-2 text-center">
            {tab === 'receive'
              ? `Enter the cash received · Max: ${fmt(remaining)}`
              : `Enter cash being returned by person · Max: ${fmt(alreadyPaid)} (already received)`}
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl text-rose-700 dark:text-rose-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider">
                {tab === 'receive' ? 'Cash Received Amount *' : 'Cash Return Amount *'}
              </label>
              <span className="text-[11px] text-slate-500 dark:text-[#8ba895]">
                Max: {fmt(maxAmt)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">
                Rs.
              </span>
              <input
                type="number"
                step="1"
                min="1"
                max={maxAmt}
                placeholder="0"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(null); }}
                autoFocus
                required
                className={`w-full pl-11 pr-4 py-2.5 bg-white dark:bg-[#142119] border rounded-xl text-lg font-bold focus:outline-none focus:ring-2 transition-colors ${
                  isOver
                    ? 'border-rose-400 dark:border-rose-600 focus:ring-rose-400 text-rose-600'
                    : tab === 'return'
                    ? 'border-rose-200 dark:border-rose-900/60 focus:ring-rose-500 text-slate-800 dark:text-[#e2f5e8]'
                    : 'border-slate-200 dark:border-[#2d4a35] focus:ring-emerald-500 text-slate-800 dark:text-[#e2f5e8]'
                }`}
              />
            </div>
            {isOver && (
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
                {tab === 'receive'
                  ? `Cannot exceed remaining balance of ${fmt(remaining)}.`
                  : `Cannot exceed cash already received (${fmt(alreadyPaid)}).`}
              </p>
            )}
            {/* Live preview after transaction */}
            {!isOver && parsedAmt > 0 && Number.isFinite(parsedAmt) && (
              <div className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-[11px] text-slate-600 dark:text-[#8ba895] flex justify-between">
                <span>After this {tab === 'receive' ? 'receipt' : 'return'}:</span>
                <span className="font-semibold">
                  Received: {fmt(tab === 'receive' ? alreadyPaid + parsedAmt : Math.max(0, alreadyPaid - parsedAmt))}
                  &nbsp;·&nbsp;
                  Remaining: {fmt(tab === 'receive' ? Math.max(0, remaining - parsedAmt) : remaining + parsedAmt)}
                </span>
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
              <Calendar className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
              <FileText className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />
              Notes / Reference
            </label>
            <input
              type="text"
              placeholder="Optional reference or note…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#a7c4ae] font-semibold text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || loading}
              className={`flex-1 px-4 py-2.5 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-sm transition-colors ${
                tab === 'return'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading
                ? 'Saving…'
                : tab === 'receive'
                ? 'Confirm Receipt'
                : 'Confirm Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
