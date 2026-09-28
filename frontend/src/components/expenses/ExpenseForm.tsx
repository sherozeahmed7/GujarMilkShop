import React, { useMemo, useState } from 'react';
import { useExpenseStore } from '../../store/expenseStore';
import { Wallet } from 'lucide-react';

export const ExpenseForm: React.FC = () => {
  const { createExpense, isSaving } = useExpenseStore();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [product, setProduct] = useState('');
  const [amount, setAmount] = useState('');
  const [paidNow, setPaidNow] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const total = parseFloat(amount) || 0;
  const paid = paidNow.trim() === '' ? 0 : parseFloat(paidNow) || 0;
  const remaining = useMemo(() => Math.max(0, Math.round((total - paid) * 100) / 100), [total, paid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const productText = product.trim();
    if (!date || !productText) {
      setError('Date and product are required.');
      return;
    }
    if (!Number.isFinite(total) || total <= 0) {
      setError('Enter a total amount greater than zero.');
      return;
    }
    if (!Number.isFinite(paid) || paid < 0) {
      setError('Paid amount must be 0 or greater.');
      return;
    }
    if (paid > total) {
      setError('Paid now cannot exceed total amount.');
      return;
    }

    try {
      await createExpense({
        date,
        category: productText,
        description: productText,
        quantity: 0,
        unitCost: 0,
        grossLoss: total,
        soldRecovery: 0,
        netExpense: total,
        amount: total,
        paidAmount: paid,
        remaining: Math.max(0, total - paid),
        reason: notes.trim() || undefined,
        addedBy: localStorage.getItem('userName') || 'User',
      });

      setProduct('');
      setAmount('');
      setPaidNow('');
      setNotes('');
      setSuccess(
        paid === 0
          ? `Expense saved as unpaid (Remaining Rs. ${total.toLocaleString()}).`
          : paid < total
            ? `Expense saved. Remaining Rs. ${Math.round(total - paid).toLocaleString()} to clear later.`
            : 'Expense saved. Paid in full and deducted from open shift expected cash.'
      );
    } catch (err: any) {
      setError(err?.message || 'Unable to save expense. Please try again.');
    }
  };

  const inputClass = "px-3 py-2 border border-slate-200 dark:border-[#2d4a35] rounded-lg text-sm text-slate-700 dark:text-[#e2f5e8] bg-white dark:bg-[#142119] focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-[#22c55e] placeholder-slate-400 dark:placeholder-slate-600";
  const labelClass = "text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider";

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5">
      <div className="flex items-center gap-2 mb-1">
        <Wallet className="w-5 h-5 text-rose-500" />
        <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Add Expense</h2>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
        Record shop costs (milk, yogurt, shoppers, etc.). Cash paid now is taken from the open shift
        expected cash. Any unpaid balance stays on the table until you clear it.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => { setDate(e.target.value); setSuccess(null); }}
              className={inputClass}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-1 lg:col-span-1">
            <label className={labelClass}>Product</label>
            <input
              type="text"
              value={product}
              onChange={(e) => { setProduct(e.target.value); setSuccess(null); }}
              placeholder="e.g. Milk, Yogurt, Shoppers"
              className={inputClass}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Total amount (Rs)</label>
            <input
              type="number"
              min="0"
              step="1"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setSuccess(null); }}
              placeholder="20000"
              className={`${inputClass} font-semibold`}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className={labelClass}>Paid now (Rs)</label>
              {total > 0 && (
                <button
                  type="button"
                  onClick={() => { setPaidNow(String(total)); setSuccess(null); }}
                  className="text-[11px] font-medium text-blue-600 dark:text-[#22c55e] hover:underline"
                >
                  Pay Full (Rs. {total.toLocaleString()})
                </button>
              )}
            </div>
            <input
              type="number"
              min="0"
              step="1"
              value={paidNow}
              onChange={(e) => { setPaidNow(e.target.value); setSuccess(null); }}
              placeholder="0 (leave blank for unpaid)"
              className={inputClass}
            />
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {paid === 0
                ? `Unpaid expense. Remaining: Rs. ${remaining.toLocaleString()}`
                : `Paying Rs. ${paid.toLocaleString()}. Remaining: Rs. ${remaining.toLocaleString()}`}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 flex flex-col gap-1.5 w-full">
            <label className={labelClass}>Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. bought from market, supplier bill"
              className={inputClass}
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 dark:bg-[#22c55e] hover:bg-emerald-700 dark:hover:bg-[#1ea34d] text-white dark:text-[#0d1a10] font-semibold rounded-lg transition-colors disabled:opacity-70 whitespace-nowrap"
          >
            {isSaving ? 'Saving…' : 'Save Expense'}
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            {success}
          </div>
        )}
      </form>
    </div>
  );
};
