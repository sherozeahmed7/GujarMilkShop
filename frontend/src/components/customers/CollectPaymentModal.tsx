import React, { useState } from 'react';
import { Customer } from '../../types';
import { X, DollarSign, Wallet } from 'lucide-react';

interface CollectPaymentModalProps {
  customer: Customer;
  onClose: () => void;
}

export const CollectPaymentModal: React.FC<CollectPaymentModalProps> = ({ customer, onClose }) => {
  const [amount, setAmount] = useState<string>('');
  const [method, setMethod] = useState<string>('Cash');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) { setError('Amount must be greater than zero'); return; }
    if (numAmount > customer.balance) { setError(`Cannot collect more than Rs. ${customer.balance.toLocaleString()}`); return; }
    // No-op: kept for UI compatibility. Payment collection is done via Customers page → settle-all.
    onClose();
  };

  const handleFullPayment = () => {
    setAmount(customer.balance.toString());
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#2d4a35]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Collect Payment</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-[#8ba895]">From: {customer.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex justify-between items-center">
            <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Current Outstanding</span>
            <div className="flex flex-col items-end gap-1">
              <span className="text-lg font-bold text-rose-700">Rs. {customer.balance.toLocaleString()}</span>
              <button 
                type="button" 
                onClick={handleFullPayment}
                className="text-[10px] font-bold text-rose-600 bg-white dark:bg-[#142119] border border-rose-200 px-2 py-0.5 rounded hover:bg-rose-100 transition-colors"
              >
                PAY FULL
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-[#a7c4ae] uppercase tracking-wider">Amount Collected *</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Wallet className="h-5 w-5 text-slate-400 dark:text-[#64916e]" />
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError('');
                }}
                placeholder="0.00"
                className={`w-full pl-11 pr-4 py-3 bg-white dark:bg-[#142119] border rounded-xl text-xl font-bold text-slate-800 dark:text-[#e2f5e8] focus:ring-2 transition-all ${
                  error ? 'border-rose-300 focus:ring-rose-500' : 'border-slate-200 dark:border-[#2d4a35] focus:ring-emerald-500 focus:border-emerald-500'
                }`}
                autoFocus
                required
              />
            </div>
            {error && <span className="text-xs font-medium text-rose-600 mt-1">{error}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-[#a7c4ae] uppercase tracking-wider">Payment Method</label>
            <select 
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl text-sm font-medium text-slate-700 dark:text-[#a7c4ae] focus:ring-2 focus:ring-emerald-500"
            >
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="JazzCash / EasyPaisa">JazzCash / EasyPaisa</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-[#a7c4ae] uppercase tracking-wider">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cleared monthly dues"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl text-sm text-slate-700 dark:text-[#a7c4ae] focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#a7c4ae] rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={numAmount <= 0 || numAmount > customer.balance}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Record Payment
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
