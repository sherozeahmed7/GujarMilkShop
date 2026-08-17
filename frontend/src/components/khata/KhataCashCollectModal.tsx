import React, { useState } from 'react';
import { Customer } from '../../types';
import { useCustomerStore } from '../../store/customerStore';
import { X, DollarSign, Wallet, CheckCircle } from 'lucide-react';

interface KhataCashCollectModalProps {
  customer: Customer;
  onClose: () => void;
}

export const KhataCashCollectModal: React.FC<KhataCashCollectModalProps> = ({ customer, onClose }) => {
  const { collectPayment } = useCustomerStore();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) { setError('Amount must be greater than zero'); return; }
    if (numAmount > customer.balance) {
      setError(`Cannot collect more than the outstanding balance (Rs. ${customer.balance.toLocaleString()})`);
      return;
    }
    collectPayment(customer.id, numAmount, method, notes);
    setSuccess(true);
    setTimeout(() => onClose(), 1200);
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-xl p-8 flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Payment Recorded!</h3>
          <p className="text-sm text-slate-500">Rs. {numAmount.toLocaleString()} collected from {customer.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Cash Collect</h3>
              <p className="text-xs font-medium text-slate-500">{customer.name} • Card #{customer.cardNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">

          <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-rose-500 uppercase tracking-wider block">Outstanding Balance</span>
              <span className="text-xl font-bold text-rose-700 mt-1 block">Rs. {customer.balance.toLocaleString()}</span>
            </div>
            <button
              type="button"
              onClick={() => { setAmount(customer.balance.toString()); setError(''); }}
              className="text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 px-3 py-1.5 rounded-lg transition-colors"
            >
              Pay Full
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Amount (Rs) *</label>
            <div className="relative">
              <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="number"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(''); }}
                placeholder="0.00"
                autoFocus
                className={`w-full pl-11 pr-4 py-3 text-xl font-bold bg-slate-50 border rounded-xl focus:ring-2 transition-all ${error ? 'border-rose-300 focus:ring-rose-500 text-rose-700' : 'border-slate-200 focus:ring-emerald-500 text-slate-800'}`}
                required
              />
            </div>
            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Payment Method</label>
            <div className="flex gap-2">
              {['Cash', 'Bank Transfer', 'JazzCash'].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${method === m ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Monthly dues cleared"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex gap-3 mt-1">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors">Cancel</button>
            <button
              type="submit"
              disabled={numAmount <= 0 || numAmount > customer.balance}
              className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm Payment
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
