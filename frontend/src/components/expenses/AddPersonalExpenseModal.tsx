import React, { useState } from 'react';
import { X, Plus, Calendar, Tag, FileText } from 'lucide-react';
import { createExpense } from '../../services/expenseService';

interface AddPersonalExpenseModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddPersonalExpenseModal: React.FC<AddPersonalExpenseModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Personal');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmt = Number(amount);
    if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
      setError('Please enter a valid expense amount greater than zero.');
      return;
    }

    const desc = description.trim();
    if (!desc) {
      setError('Please provide a description or purpose for this personal expense.');
      return;
    }

    setLoading(true);
    try {
      await createExpense({
        date,
        category: category.trim() || 'Personal',
        description: desc,
        quantity: 0,
        unitCost: 0,
        grossLoss: parsedAmt,
        soldRecovery: 0,
        netExpense: parsedAmt,
        amount: parsedAmt,
        paidAmount: 0, // Unsettled personal expense; settled via Cash Received
        remaining: parsedAmt,
        reason: notes.trim() || undefined,
        addedBy: localStorage.getItem('userName') || 'User',
        expenseType: 'PERSONAL',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to add personal expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex justify-between items-center bg-slate-50 dark:bg-[#142119]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-base">Add Personal Expense</h3>
              <p className="text-xs text-slate-500 dark:text-[#8ba895]">Separate from shop business operations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#e2f5e8] hover:bg-slate-100 dark:hover:bg-[#1e3124] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 rounded-xl text-rose-700 dark:text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
              Description / Purpose *
            </label>
            <input
              type="text"
              placeholder="e.g. Home purchase, Family groceries, Fuel, Medical"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              autoFocus
              required
              className="w-full px-3.5 py-2 text-sm bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#22c55e]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
                Amount (Rs.) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold">
                  Rs.
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#22c55e]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
                Category
              </label>
              <input
                type="text"
                placeholder="Personal"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#22c55e]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
              Date *
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#22c55e]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
              Notes (Optional)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <textarea
                rows={2}
                placeholder="Any additional details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#22c55e] resize-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-[#8ba895] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-bold text-white dark:text-[#0d1a10] bg-emerald-600 hover:bg-emerald-700 dark:bg-[#22c55e] dark:hover:bg-[#1ea34d] rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? 'Adding…' : 'Save Personal Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
