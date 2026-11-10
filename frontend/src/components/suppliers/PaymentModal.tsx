import React, { useState, useRef } from 'react';
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
  const [discount, setDiscount] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [method, setMethod] = useState('cash');
  const [paymentSource, setPaymentSource] = useState<'shift' | 'hand'>('shift');
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState<string>(todayStr);

  const payable = Math.max(0, supplier.payableBalance || 0);
  const numAmount = amount.trim() === '' ? 0 : parseFloat(amount);
  const numDiscount = discount.trim() === '' ? 0 : parseFloat(discount);
  const combined =
    (Number.isFinite(numAmount) ? numAmount : 0) + (Number.isFinite(numDiscount) ? numDiscount : 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || isSubmittingRef.current) return;

    if (!Number.isFinite(numAmount) || numAmount < 0) {
      setError('Please enter a valid payment amount.');
      return;
    }
    if (!Number.isFinite(numDiscount) || numDiscount < 0) {
      setError('Please enter a valid discount amount.');
      return;
    }
    if (numAmount <= 0 && numDiscount <= 0) {
      setError('Enter a payment amount and/or a discount greater than zero.');
      return;
    }
    if (combined > payable) {
      setError(`Payment + discount cannot exceed payable Rs. ${payable}.`);
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const paymentUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;
      await addPayment({
        supplierId: supplier.id,
        date,
        amount: numAmount,
        method,
        paymentSource: method === 'cash' ? paymentSource : 'hand',
        notes,
        ...(paymentUuid ? { clientUuid: paymentUuid } : {}),
        ...(numDiscount > 0 ? { discount: numDiscount } : {}),
      });
      await onPaid?.();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Payment failed');
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const canSubmit =
    payable > 0 &&
    Number.isFinite(numAmount) &&
    Number.isFinite(numDiscount) &&
    numAmount >= 0 &&
    numDiscount >= 0 &&
    combined > 0 &&
    combined <= payable + 1e-9;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 my-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#2d4a35] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Make Payment</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-[#8ba895]">To: {supplier.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-[#e2f5e8] hover:bg-slate-100 dark:hover:bg-[#142119] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto overscroll-contain">
          <div className="bg-amber-50 dark:bg-[#2a2414] border border-amber-100 dark:border-amber-900/40 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-amber-800/70 dark:text-amber-300 uppercase tracking-wider">
                Gross purchases − paid
              </span>
              <span className="text-sm font-semibold text-slate-700 dark:text-[#e2f5e8]">
                Rs.{' '}
                {(
                  supplier.grossPayable ??
                  supplier.payableBalance + (supplier.guaranteedAdvance || 0)
                ).toLocaleString()}
              </span>
            </div>
            {(supplier.guaranteedAdvance || 0) > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Advance
                </span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  −Rs. {supplier.guaranteedAdvance.toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-amber-200/80 dark:border-amber-900/60">
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                Payable now
              </span>
              <span
                className={`text-lg font-bold ${supplier.payableBalance < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}
              >
                {supplier.payableBalance < 0
                  ? `Rs. −${Math.abs(supplier.payableBalance).toLocaleString()}`
                  : `Rs. ${supplier.payableBalance.toLocaleString()}`}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-[#8ba895] uppercase tracking-wider">
              Payment Amount
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-slate-400 dark:text-[#64916e]" />
              </div>
              <input
                type="number"
                min="0"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String(Math.max(0, payable - (Number.isFinite(numDiscount) ? numDiscount : 0)))}
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl text-xl font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                autoFocus
              />
            </div>
            {(supplier.guaranteedAdvance || 0) > 0 && (
              <p className="text-[11px] text-slate-500 dark:text-[#8ba895]">
                Advance (−Rs. {supplier.guaranteedAdvance.toLocaleString()}) is already deducted from
                payable above.
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-[#8ba895] uppercase tracking-wider">
              Discount Amount
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
            />
            <p className="text-[11px] text-slate-500 dark:text-[#8ba895]">
              Written off from payable — discarded permanently (not counted as cash paid out).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-[#8ba895] uppercase tracking-wider">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 dark:text-[#8ba895] uppercase tracking-wider">
                Payment Method
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl text-sm font-medium focus:ring-2 focus:ring-emerald-500"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="jazzcash">JazzCash</option>
              </select>
            </div>
          </div>

          {/* Payment Source Selection (When Cash) */}
          {method === 'cash' && (
            <div className="flex flex-col gap-1.5 p-3 rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-slate-50/70 dark:bg-[#142119]">
              <label className="text-xs font-bold text-slate-700 dark:text-[#e2f5e8] uppercase tracking-wider">
                Pay Cash From:
              </label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setPaymentSource('shift')}
                  className={`p-2.5 rounded-lg border text-left transition-all text-xs font-medium flex flex-col justify-between ${
                    paymentSource === 'shift'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#1a2e1f] text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#223927]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${paymentSource === 'shift' ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-300 dark:bg-[#3d5a45]'}`} />
                    Current Shift Drawer
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-[#8ba895] mt-1 font-normal">
                    Minus from active shift expected cash
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentSource('hand')}
                  className={`p-2.5 rounded-lg border text-left transition-all text-xs font-medium flex flex-col justify-between ${
                    paymentSource === 'hand'
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-300 font-bold ring-1 ring-emerald-500'
                      : 'border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#1a2e1f] text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#223927]'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${paymentSource === 'hand' ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-slate-300 dark:bg-[#3d5a45]'}`} />
                    Total Cash in Hand
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-[#8ba895] mt-1 font-normal">
                    Paid outside shift · minus from Total Cash
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 dark:text-[#8ba895] uppercase tracking-wider">
              Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cleared past dues"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl text-sm focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 px-4 py-3 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] rounded-xl font-semibold hover:bg-slate-50 dark:hover:bg-[#1a2e1f] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || submitting}
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
