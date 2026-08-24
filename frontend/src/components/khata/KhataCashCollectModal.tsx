import React, { useState } from 'react';
import { X, DollarSign, AlertTriangle } from 'lucide-react';
import { ApiCustomer } from '../../types/customer';
import { customerService } from '../../services/customer.service';

interface KhataCashCollectModalProps {
  customer: ApiCustomer;
  onClose: () => void;
  onCollected: () => void;
}

export const KhataCashCollectModal: React.FC<KhataCashCollectModalProps> = ({
  customer,
  onClose,
  onCollected,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');

  const totalAmount = customer.totalDue ?? 0;

  const handleConfirm = async () => {
    setError(null);

    if (customAmount.trim() !== '') {
      const parsed = Number(customAmount);
      if (Number.isNaN(parsed) || parsed <= 0) {
        setError('Please enter a valid amount greater than zero.');
        return;
      }
      if (parsed > totalAmount) {
        setError(`Amount cannot exceed the outstanding balance of Rs. ${totalAmount}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await customerService.settleAll(
        customer.id,
        paymentMethod,
        customAmount.trim() === '' ? undefined : Number(customAmount)
      );
      onCollected();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to collect payment');
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
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Cash Collect</h3>
              <p className="text-xs font-medium text-slate-500">
                {customer.name}
                {customer.phone ? ` · ${customer.phone}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-bold">Clear all outstanding bills?</p>
              <p className="mt-1 text-amber-800/90">
                This settles every unpaid / partial ledger bill for this customer.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600">Total to collect</span>
            <span className="text-xl font-black text-rose-600">
              Rs. {Math.round(totalAmount).toLocaleString()}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Optional amount to collect now
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={`Full amount: ${totalAmount}`}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">
              Leave blank to clear the full outstanding balance. Any remaining amount stays on khata.
            </p>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
              Payment Method
            </p>
            <div className="flex gap-2">
              {(['cash', 'online'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    paymentMethod === m
                      ? 'bg-slate-800 text-white border-slate-800'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {m === 'cash' ? 'Cash' : 'Online'}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm font-medium">
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || totalAmount <= 0 || (customAmount.trim() !== '' && Number(customAmount) > totalAmount)}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-40"
          >
            {submitting ? 'Collecting…' : customAmount.trim() === '' ? 'Confirm Collect' : 'Collect Partial'}
          </button>
        </div>
      </div>
    </div>
  );
};
