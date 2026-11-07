import React, { useState, useEffect } from 'react';
import { X, Plus, Calendar, Tag, FileText, Users, ChevronDown } from 'lucide-react';
import { getExpenseCustomers, createExpense } from '../../services/expenseService';
import { ExpenseCustomer } from '../../types/expense';

interface AddPersonalExpenseModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const AddPersonalExpenseModal: React.FC<AddPersonalExpenseModalProps> = ({
  onClose,
  onSuccess,
}) => {
  const [description, setDescription] = useState('');
  const [customers, setCustomers] = useState<ExpenseCustomer[]>([]);

  const fetchCustomers = () => {
    getExpenseCustomers({ customerCategory: 'PERSONAL' })
      .then((data) => setCustomers(data || []))
      .catch((err) => console.error('Failed to load expense customers:', err));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

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
      setError('Please provide a customer name or description for this personal expense.');
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
        paidAmount: 0,
        remaining: parsedAmt,
        reason: notes.trim() || undefined,
        addedBy: localStorage.getItem('userName') || 'User',
        expenseType: 'PERSONAL',
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save personal expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-[#2d4a35]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] bg-slate-50/50 dark:bg-[#142119]">
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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider">
                Customer / Name *
              </label>
              <span className="text-[10px] text-slate-400 dark:text-[#8ba895]">Select or type custom</span>
            </div>
            <div className="relative">
              <input
                type="text"
                list="personal-expense-customers-list"
                placeholder="Choose customer or type name/purpose..."
                value={description}
                onFocus={fetchCustomers}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 pr-8 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#22c55e] [appearance:textfield] [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                required
              />
              <datalist id="personal-expense-customers-list">
                {customers.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.phone ? `${c.name} (${c.phone})` : c.name}
                  </option>
                ))}
              </datalist>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                <ChevronDown className="w-4 h-4 opacity-70" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
                Amount (Rs) *
              </label>
              <input
                type="number"
                min="1"
                placeholder="5000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] text-sm font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#22c55e]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
                Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#22c55e]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
              Category
            </label>
            <input
              type="text"
              placeholder="Personal, Home, Fuel, Loan, etc."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#22c55e]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wider mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Any context or expected return date..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] text-sm rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-[#22c55e] resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#8ba895] hover:bg-slate-50 dark:hover:bg-[#1e3124] text-xs font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 dark:bg-[#22c55e] hover:bg-emerald-700 dark:hover:bg-[#1ea34d] text-white dark:text-[#0d1a10] text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              {loading ? 'Adding...' : 'Save Personal Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
