import React, { useState } from 'react';
import { X, DollarSign, AlertTriangle } from 'lucide-react';
import { CustomerTableRow } from '../../types/customer';

interface CollectConfirmModalProps {
  row: CustomerTableRow;
  onClose: () => void;
  onConfirm: (
    paymentMethod: 'cash' | 'online',
    amount?: number,
    discount?: number
  ) => Promise<void>;
}

export const CollectConfirmModal: React.FC<CollectConfirmModalProps> = ({
  row,
  onClose,
  onConfirm,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [discountAmount, setDiscountAmount] = useState<string>('');

  const totalAmount = row.balance ?? 0;
  const parsedDiscount = discountAmount.trim() === '' ? 0 : Number(discountAmount);
  const parsedCollect = customAmount.trim() === '' ? null : Number(customAmount);
  const effectiveCollect =
    parsedCollect === null
      ? Math.max(0, Math.round((totalAmount - (Number.isFinite(parsedDiscount) ? parsedDiscount : 0)) * 100) / 100)
      : parsedCollect;
  const combined =
    (Number.isFinite(effectiveCollect) ? effectiveCollect : 0) +
    (Number.isFinite(parsedDiscount) ? parsedDiscount : 0);

  const handleConfirm = async () => {
    setError(null);

    const discount = discountAmount.trim() === '' ? 0 : Number(discountAmount);
    if (Number.isNaN(discount) || discount < 0) {
      setError('Please enter a valid discount (0 or more).');
      return;
    }

    if (customAmount.trim() !== '') {
      const parsed = Number(customAmount);
      if (Number.isNaN(parsed) || parsed < 0) {
        setError('Please enter a valid amount.');
        return;
      }
      if (parsed <= 0 && discount <= 0) {
        setError('Enter a collection amount and/or a discount greater than zero.');
        return;
      }
      if (parsed + discount > totalAmount) {
        setError(`Cash + discount cannot exceed outstanding Rs. ${totalAmount}.`);
        return;
      }
    } else if (discount > totalAmount) {
      setError(`Discount cannot exceed outstanding Rs. ${totalAmount}.`);
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(
        paymentMethod,
        customAmount.trim() === '' ? undefined : Number(customAmount),
        discount > 0 ? discount : undefined
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to collect payment');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    totalAmount > 0 &&
    !Number.isNaN(parsedDiscount) &&
    parsedDiscount >= 0 &&
    (parsedCollect === null || (!Number.isNaN(parsedCollect) && parsedCollect >= 0)) &&
    combined > 0 &&
    combined <= totalAmount + 1e-9;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Collect Payment</h3>
              <p className="text-xs font-medium text-slate-500">{row.name}</p>
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
                This will mark every unpaid / partial bill for this customer as fully paid.
                This cannot be undone from the UI.
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 flex justify-between items-center">
            <span className="text-sm font-medium text-slate-600">Total to collect</span>
            <span className="text-xl font-black text-rose-600">
              Rs. {totalAmount.toLocaleString()}
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
              placeholder={`Full after discount: ${Math.max(0, totalAmount - (Number.isFinite(parsedDiscount) ? parsedDiscount : 0))}`}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">
              Leave blank to collect the full outstanding balance (minus any discount). Any unpaid amount stays on khata.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Discount amount
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">
              Written off from remaining — discarded permanently (not counted as cash collected).
            </p>
          </div>

          {row.phone && (
            <p className="text-xs text-slate-500">
              Phone: <span className="font-semibold text-slate-700">{row.phone}</span>
            </p>
          )}

          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Payment method
            </label>
            <div className="mt-2 flex gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  paymentMethod === 'cash'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Cash
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('online')}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  paymentMethod === 'online'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Online
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm font-medium">
              {error}
            </div>
          )}
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !canSubmit}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting
              ? 'Collecting…'
              : customAmount.trim() === '' && discountAmount.trim() === ''
                ? 'Yes, Clear All Bills'
                : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
};
