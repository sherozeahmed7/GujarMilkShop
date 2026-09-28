import React, { useState } from 'react';
import { X, Banknote } from 'lucide-react';
import { CalculatedStatement, MonthlyStatement, AddPaymentPayload } from '../../types/customerMilkReport';
import { customerMilkReportService } from '../../services/customerMilkReportService';
import toast from 'react-hot-toast';

interface ReceivePaymentModalProps {
  stmt: MonthlyStatement;
  calc: CalculatedStatement;
  onClose: () => void;
  onPaymentAdded: () => void;
}

const fmtRs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

export const ReceivePaymentModal: React.FC<ReceivePaymentModalProps> = ({
  stmt, calc, onClose, onPaymentAdded,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'Cash' | 'Online' | 'Bank Transfer'>('Cash');
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(today);
  const [isSaving, setIsSaving] = useState(false);
  const [amtError, setAmtError] = useState('');

  const handleSubmit = async () => {
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setAmtError('Please enter a valid payment amount.');
      return;
    }
    if (parsed > calc.remaining) {
      setAmtError(`Amount cannot exceed the remaining balance of ${fmtRs(calc.remaining)}.`);
      return;
    }
    setAmtError('');

    const payload: AddPaymentPayload = {
      customerId: stmt.customerId,
      month: stmt.month,
      year: stmt.year,
      amount: parsed,
      method,
      notes,
      date: new Date(date).toISOString(),
    };

    try {
      setIsSaving(true);
      toast.loading('Recording payment...', { id: 'payment-toast' });
      await customerMilkReportService.addPayment(payload);
      toast.success('Payment recorded successfully!', { id: 'payment-toast' });
      onPaymentAdded();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment.', { id: 'payment-toast' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35]">
          <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
            <Banknote className="w-5 h-5" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Receive Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-[#142119] rounded-lg text-sm">
            <div>
              <div className="text-xs text-slate-500 dark:text-[#8ba895] mb-0.5">Customer</div>
              <div className="font-semibold text-slate-800 dark:text-[#e2f5e8] truncate">{stmt.customerName}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-[#8ba895] mb-0.5">Current Balance</div>
              <div className={`font-bold ${calc.remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-[#8ba895]'}`}>
                {fmtRs(calc.remaining)}
              </div>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">
              Payment Amount <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-[#8ba895] text-sm font-medium">Rs.</span>
              <input
                type="number"
                min={1}
                max={calc.remaining}
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setAmtError(''); }}
                placeholder="0"
                className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
              />
            </div>
            {amtError && <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{amtError}</p>}
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">Payment Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">Payment Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            >
              <option value="Cash">Cash</option>
              <option value="Online">Online</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional note..."
              className="w-full px-3 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] rounded-b-2xl">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-200 dark:hover:bg-[#1e3124] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Receive Payment'}
          </button>
        </div>
      </div>
    </div>
  );
};
