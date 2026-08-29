import React, { useState } from 'react';
import { X, ArrowDownToLine, ArrowUpFromLine, DollarSign, CalendarDays, AlignLeft, Info } from 'lucide-react';
import { CashPerson, AddTransactionPayload } from '../../types/cashbook';
import { addCashbookTransaction } from '../../services/cashbook.service';

interface Props {
  person: CashPerson;
  onClose: () => void;
  onSuccess: () => void;
}

type TxType = 'Receive Amount' | 'Pay Amount';

interface FormErrors {
  amount?: string;
  transactionType?: string;
}

const fmt = (n: number) => `Rs. ${n.toLocaleString()}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

export const AmountModal: React.FC<Props> = ({ person, onClose, onSuccess }) => {
  const [txType, setTxType] = useState<TxType>('Receive Amount');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayStr());
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  const validate = (): boolean => {
    const e: FormErrors = {};
    const val = parseFloat(amount);
    if (!amount) {
      e.amount = 'Amount is required.';
    } else if (isNaN(val) || val <= 0) {
      e.amount = 'Enter a valid positive amount.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePreview = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) setPreview(true);
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      const payload: AddTransactionPayload = {
        cashPersonId: person.id,
        transactionType: txType,
        amount: parseFloat(amount),
        description: description.trim() || undefined,
        date,
      };
      await addCashbookTransaction(payload);
      onSuccess();
    } catch (err: any) {
      setErrors({ amount: err.message || 'Transaction failed.' });
      setPreview(false);
    } finally {
      setIsSaving(false);
    }
  };

  const isReceive = txType === 'Receive Amount';
  const amountVal = parseFloat(amount) || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Record Transaction</h2>
            <p className="text-xs text-slate-400 mt-0.5">Person: <span className="font-semibold text-slate-700">{person.name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!preview ? (
          <form onSubmit={handlePreview} noValidate className="p-6 space-y-5">
            {/* Transaction Type toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">Transaction Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Receive Amount', 'Pay Amount'] as TxType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTxType(t)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                      txType === t
                        ? t === 'Receive Amount'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : 'border-rose-500 bg-rose-50 text-rose-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  >
                    {t === 'Receive Amount'
                      ? <ArrowDownToLine className="w-4 h-4" />
                      : <ArrowUpFromLine className="w-4 h-4" />}
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex items-start gap-2 mt-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                <Info className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500">
                  {isReceive
                    ? `Money coming FROM ${person.name} TO us.`
                    : `Money going FROM us TO ${person.name}.`}
                </p>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Amount <span className="text-rose-500">*</span></span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium pointer-events-none">Rs.</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className={`w-full pl-12 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.amount ? 'border-rose-400 bg-rose-50' : 'border-slate-200'}`}
                />
              </div>
              {errors.amount && <p className="mt-1 text-xs text-rose-500">{errors.amount}</p>}
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Date</span>
              </label>
              <input
                type="date"
                value={date}
                max={todayStr()}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5"><AlignLeft className="w-3.5 h-3.5" /> Note / Description</span>
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional note…"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
              <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm transition-all ${isReceive ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'}`}
              >
                Preview
              </button>
            </div>
          </form>
        ) : (
          /* Preview screen */
          <div className="p-6 space-y-5">
            <div className={`rounded-xl border p-5 space-y-4 ${isReceive ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${isReceive ? 'text-emerald-600' : 'text-rose-600'}`}>
                Confirm Transaction
              </p>
              <div className="space-y-3 text-sm">
                <Row label="Person" value={person.name} />
                <Row label="Action" value={txType} />
                <Row label="Amount" value={fmt(amountVal)} bold />
                <Row label="Date" value={date} />
                {description && <Row label="Note" value={description} />}
              </div>
            </div>

            {errors.amount && (
              <p className="text-xs text-rose-500 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">{errors.amount}</p>
            )}

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreview(false)}
                disabled={isSaving}
                className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-50"
              >
                ← Edit
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSaving}
                className={`px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm transition-all disabled:opacity-50 flex items-center gap-2 ${isReceive ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
              >
                {isSaving ? (
                  <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                ) : 'Confirm & Save'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; bold?: boolean }> = ({ label, value, bold }) => (
  <div className="flex items-center justify-between">
    <span className="text-slate-500">{label}</span>
    <span className={`text-slate-800 ${bold ? 'font-bold text-base' : 'font-medium'}`}>{value}</span>
  </div>
);
