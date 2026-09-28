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
  const [discountAmount, setDiscountAmount] = useState<string>('');

  const totalAmount = customer.totalDue ?? 0;
  const parsedDiscount = discountAmount.trim() === '' ? 0 : Number(discountAmount);
  const amountBlank = customAmount.trim() === '';
  const parsedCollect = amountBlank ? NaN : Number(customAmount);
  const combined =
    (Number.isFinite(parsedCollect) ? parsedCollect : 0) +
    (Number.isFinite(parsedDiscount) ? parsedDiscount : 0);

  const handleConfirm = async () => {
    setError(null);

    if (amountBlank) {
      setError('Enter the amount to collect before confirming.');
      return;
    }

    const discount = discountAmount.trim() === '' ? 0 : Number(discountAmount);
    if (Number.isNaN(discount) || discount < 0) {
      setError('Please enter a valid discount (0 or more).');
      return;
    }

    const parsed = Number(customAmount);
    if (Number.isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid collection amount.');
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

    setSubmitting(true);
    try {
      await customerService.settleAll(
        customer.id,
        paymentMethod,
        parsed,
        discount > 0 ? discount : undefined
      );
      onCollected();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to collect payment');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    totalAmount > 0 &&
    !amountBlank &&
    Number.isFinite(parsedCollect) &&
    parsedCollect >= 0 &&
    !Number.isNaN(parsedDiscount) &&
    parsedDiscount >= 0 &&
    combined > 0 &&
    combined <= totalAmount + 1e-9;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#2d4a35]">
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
              <p className="font-bold">Collect payment toward outstanding bills</p>
              <p className="mt-1 text-amber-800/90">
                Enter how much you are collecting now. You cannot confirm without an amount.
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
              Amount to collect now <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              placeholder={`Max: ${Math.round(totalAmount)}`}
              className="w-full rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-[#e2f5e8] placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              autoFocus
            />
            <p className="text-[11px] text-slate-500">
              Required. Type the exact cash/online amount. Any unpaid balance stays on khata.
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
              className="w-full rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] px-3 py-2.5 text-sm font-medium text-slate-800 dark:text-[#e2f5e8] placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500">
              Written off from remaining — discarded permanently (not counted as cash collected).
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
                      ? 'bg-slate-800 dark:bg-slate-700 text-white border-slate-800 dark:border-slate-700'
                      : 'bg-white dark:bg-[#142119] text-slate-600 dark:text-[#e2f5e8] border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#1a2e1f]'
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
            className="flex-1 py-3 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-[#1a2e1f]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting || !canSubmit}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-40"
          >
            {submitting ? 'Collecting…' : 'Confirm Collect'}
          </button>
        </div>
      </div>
    </div>
  );
};
