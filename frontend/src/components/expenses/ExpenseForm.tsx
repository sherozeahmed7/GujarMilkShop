import React, { useState } from 'react';
import { useExpenseStore } from '../../store/expenseStore';
import { ExpenseCategory } from '../../types';
import { Wallet } from 'lucide-react';

/** Simple weekly/monthly expenses — amount only (no kg). */
export const ExpenseForm: React.FC = () => {
  const { createExpense, isSaving } = useExpenseStore();

  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<ExpenseCategory>('Electricity');
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'once'>('monthly');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!date || isNaN(amt) || amt <= 0) {
      alert('Enter a valid amount greater than 0.');
      return;
    }

    try {
      await createExpense({
        date,
        category,
        quantity: 0,
        unitCost: 0,
        grossLoss: amt,
        soldRecovery: 0,
        netExpense: amt,
        reason,
        period,
        addedBy: localStorage.getItem('userName') || 'User',
      });
      setAmount('');
      setReason('');
    } catch {
      alert('Unable to save expense. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5 text-rose-500" />
        <h2 className="text-lg font-bold text-slate-800">Add Expense</h2>
      </div>
      <p className="text-xs text-slate-500 mb-5">
        Simple shop expenses — weekly or monthly. Enter amount only (no kg).
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">DATE</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">PERIOD</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'weekly' | 'monthly' | 'once')}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="once">One-time</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">CATEGORY</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Electricity">Electricity</option>
              <option value="Gas">Gas</option>
              <option value="Water">Water</option>
              <option value="Packaging">Packaging</option>
              <option value="Other">Other</option>
              <option value="Milk">Milk wastage</option>
              <option value="Yogurt">Yogurt wastage</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">AMOUNT (Rs) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 5000"
              required
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-slate-600">NOTES</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. monthly electricity bill"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-70 whitespace-nowrap"
          >
            {isSaving ? 'Saving...' : 'Save Expense'}
          </button>
        </div>
      </form>
    </div>
  );
};
