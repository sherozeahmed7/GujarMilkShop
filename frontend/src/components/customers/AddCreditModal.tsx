import React, { useState } from 'react';
import { Customer } from '../../types';
import { X, PlusCircle } from 'lucide-react';

interface AddCreditModalProps {
  customer: Customer;
  onClose: () => void;
}

export const AddCreditModal: React.FC<AddCreditModalProps> = ({ customer, onClose }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) { setError('Amount must be greater than zero'); return; }
    // No-op: this modal is kept for UI compatibility but is no longer wired to the store.
    // Credit sales are added via the POS → Khata flow.
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-[#2d4a35]">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Add Credit</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-[#a7c4ae] uppercase tracking-wider">Amount (Rs) *</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => { setAmount(e.target.value); setError(''); }}
              className={`w-full px-4 py-2.5 bg-slate-50 dark:bg-[#142119] border rounded-xl font-bold focus:ring-2 ${error ? 'border-rose-300 focus:ring-rose-500 text-rose-800' : 'border-slate-200 dark:border-[#2d4a35] focus:ring-blue-500 text-slate-800 dark:text-[#e2f5e8]'}`}
              autoFocus
              required
            />
            {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-[#a7c4ae] uppercase tracking-wider">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 5kg Milk"
              className="w-full px-4 py-2 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl text-sm focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-[#e2f5e8]"
            />
          </div>

          <div className="flex gap-2 mt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#a7c4ae] rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={numAmount <= 0} className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50">
              Add Credit
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
