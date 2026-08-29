import React, { useState } from 'react';
import { Supplier } from '../../types';
import { useSupplierStore } from '../../store/supplierStore';
import { X, CreditCard, DollarSign } from 'lucide-react';

interface PaymentModalProps {
  supplier: Supplier;
  onClose: () => void;
  /** Fired only after payment is saved (not on cancel) */
  onPaid?: () => void | Promise<void>;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ supplier, onClose, onPaid }) => {
  const { addPayment } = useSupplierStore();
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [method, setMethod] = useState('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState<string>(todayStr);

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0 || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await addPayment({
        supplierId: supplier.id,
        date,
        amount: numAmount,
        method,
        notes
      });
      await onPaid?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Payment failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Make Payment</h3>
              <p className="text-xs font-medium text-slate-500">To: {supplier.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-5">
          
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-800/70 uppercase tracking-wider">Gross purchases − paid</span>
              <span className="text-sm font-semibold text-slate-700">
                Rs. {(supplier.grossPayable ?? supplier.payableBalance + (supplier.guaranteedAdvance || 0)).toLocaleString()}
              </span>
            </div>
            {(supplier.guaranteedAdvance || 0) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Advance</span>
                <span className="text-sm font-bold text-emerald-700">
                  −Rs. {supplier.guaranteedAdvance.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-amber-200/80">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Payable now</span>
              <span className={`text-lg font-bold ${supplier.payableBalance < 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {supplier.payableBalance < 0
                  ? `Rs. −${Math.abs(supplier.payableBalance).toLocaleString()}`
                  : `Rs. ${supplier.payableBalance.toLocaleString()}`}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Payment Amount</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(supplier.payableBalance || 0)}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                autoFocus
                required
              />
            </div>
            {(supplier.guaranteedAdvance || 0) > 0 && (
              <p className="text-[11px] text-slate-500">
                Advance (−Rs. {supplier.guaranteedAdvance.toLocaleString()}) is already deducted from payable above.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Payment Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-500">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="jazzcash">JazzCash</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cleared past dues"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={numAmount <= 0 || submitting}
              className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? 'Saving…' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
