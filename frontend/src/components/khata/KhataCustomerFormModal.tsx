import React, { useState } from 'react';
import { X, UserPlus, Edit2 } from 'lucide-react';
import {
  customerService,
  CreateCustomerPayload,
} from '../../services/customer.service';
import { ApiCustomer } from '../../types/customer';

interface KhataCustomerFormModalProps {
  customer?: ApiCustomer | null;
  onClose: () => void;
  onSaved: () => void;
}

export const KhataCustomerFormModal: React.FC<KhataCustomerFormModalProps> = ({
  customer,
  onClose,
  onSaved,
}) => {
  const isEdit = Boolean(customer);

  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [customerType, setCustomerType] = useState<'daily_ledger' | 'monthly_ledger'>(
    customer?.customerType || 'daily_ledger'
  );
  const [openingBalance, setOpeningBalance] = useState(
    customer?.openingBalance !== undefined && customer?.openingBalance !== null
      ? String(customer.openingBalance)
      : ''
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Customer name is required.');
      return;
    }

    const opening = openingBalance.trim() === '' ? 0 : Number(openingBalance);
    if (Number.isNaN(opening) || opening < 0) {
      setError('Opening balance must be a valid amount (0 or more).');
      return;
    }

    setSaving(true);
    try {
      if (isEdit && customer) {
        await customerService.updateCustomer(customer.id, {
          name: name.trim(),
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          customerType,
          openingBalance: opening,
        });
      } else {
        const payload: CreateCustomerPayload = {
          name: name.trim(),
          customerType,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(address.trim() ? { address: address.trim() } : {}),
          ...(opening > 0 ? { openingBalance: opening } : {}),
        };
        await customerService.createCustomer(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || (isEdit ? 'Failed to update customer' : 'Failed to create customer'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#2d4a35] bg-slate-50/50 dark:bg-slate-900/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              {isEdit ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">
                {isEdit ? 'Edit Customer' : 'New Khata Customer'}
              </h3>
              <p className="text-xs text-slate-500">Daily or Monthly ledger account</p>
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

        <form id="khata-cust-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-3 py-2 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Customer Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Ledger Type *
            </label>
            <div className="flex gap-2 p-1 bg-slate-50 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setCustomerType('daily_ledger')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  customerType === 'daily_ledger'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setCustomerType('monthly_ledger')}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                  customerType === 'monthly_ledger'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Phone</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300-0000000"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Opening Balance{' '}
              <span className="text-slate-400 font-normal normal-case">(optional)</span>
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="e.g. 5000 — existing dues"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-[11px] text-slate-400">
              Existing dues appear in Previous Month / Day and Remaining Balance.
            </p>
          </div>
        </form>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-[#1a2e1f] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="khata-cust-form"
            disabled={saving}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};
