import React, { useState, useEffect } from 'react';
import { X, Edit2, ShieldAlert } from 'lucide-react';
import { Supplier } from '../../types';
import { supplierService } from '../../services/supplier.service';

interface KhataSupplierFormModalProps {
  supplier: Supplier;
  onClose: () => void;
  onSaved: () => void;
}

export const KhataSupplierFormModal: React.FC<KhataSupplierFormModalProps> = ({
  supplier,
  onClose,
  onSaved,
}) => {
  // Prefill with the actual remaining balance visible in the table (remainingBalance / payableBalance)
  // This is the true amount owed to the supplier — not the stored guaranteedAdvance or openingBalance collection alone.
  const getInitialRemaining = (s: Supplier): string => {
    const remaining = s.remainingBalance ?? s.payableBalance ?? 0;
    return remaining > 0 ? String(remaining) : '0';
  };

  const [name, setName] = useState(supplier.name || '');
  const [phone, setPhone] = useState(supplier.phone || '');
  const [remainingBalance, setRemainingBalance] = useState(getInitialRemaining(supplier));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supplier) {
      setName(supplier.name || '');
      setPhone(supplier.phone || '');
      setRemainingBalance(getInitialRemaining(supplier));
    }
  }, [supplier]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Supplier name is required.');
      return;
    }

    const targetRemaining = remainingBalance.trim() === '' ? 0 : Number(remainingBalance);
    if (Number.isNaN(targetRemaining) || targetRemaining < 0) {
      setError('Remaining balance must be a valid positive amount (0 or more).');
      return;
    }

    setSaving(true);
    try {
      await supplierService.update(supplier.id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        remainingBalance: targetRemaining,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update supplier details');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              <Edit2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Edit Supplier Khata</h3>
              <p className="text-xs text-slate-500">
                Update name and opening payable balance for this supplier
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form
          id="khata-supplier-form"
          onSubmit={handleSubmit}
          className="p-5 flex flex-col gap-4 overflow-y-auto"
        >
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Supplier Info Summary Badge */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 uppercase tracking-wider">Code:</span>
              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                {supplier.code}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-500 uppercase tracking-wider">Cycle:</span>
              <span className="font-semibold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                {supplier.cycleType}
              </span>
            </div>
          </div>

          {/* Name Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Supplier / Farm Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g. Ali Farm"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Remaining Balance (total we owe this supplier) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Remaining Balance (Rs){' '}
              <span className="text-slate-400 font-normal normal-case">(total we owe this supplier)</span>
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={remainingBalance}
              onChange={(e) => setRemainingBalance(e.target.value)}
              placeholder="e.g. 10000"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-[11px] text-slate-400">
              Set the total remaining payable balance for this supplier. The system will auto-adjust the opening balance collection accordingly.
            </p>
          </div>

          {/* Phone Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Phone Number{' '}
              <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0300-1234567"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </form>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="khata-supplier-form"
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
