import React, { useState } from 'react';
import { X, User, Phone, MapPin, Tag, AlignLeft, DollarSign, BadgeCheck, Info } from 'lucide-react';
import { CashPersonType, CustomerType, CreateCashPersonPayload } from '../../types/cashbook';
import { createCashPerson } from '../../services/cashbook.service';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

interface FormErrors {
  name?: string;
  type?: string;
  openingBalance?: string;
  customerType?: string;
}

const INITIAL_FORM = {
  name: '',
  phone: '',
  address: '',
  type: '' as CashPersonType | '',
  description: '',
  openingBalance: '',
  customerType: '' as CustomerType | '',
};

export const AddCashPersonModal: React.FC<Props> = ({ onClose, onSuccess }) => {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim()) e.name = 'Name is required.';
    if (!form.type) e.type = 'Please select a type.';
    if (!form.customerType) e.customerType = 'Please select a role.';
    if (form.openingBalance === '') {
      e.openingBalance = 'Opening balance is required.';
    } else {
      const val = parseFloat(form.openingBalance);
      if (isNaN(val)) e.openingBalance = 'Enter a valid number.';
      else if (val < 0) e.openingBalance = 'Opening balance cannot be negative.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);
    try {
      const payload: CreateCashPersonPayload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        type: form.type as CashPersonType,
        description: form.description.trim() || undefined,
        openingBalance: parseFloat(form.openingBalance),
        customerType: form.customerType as CustomerType,
      };
      await createCashPerson(payload);
      onSuccess();
    } catch (err: any) {
      setErrors({ name: err.message || 'Failed to create cash person.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl border border-slate-100 dark:border-[#2d4a35] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-[#2d4a35] sticky top-0 bg-white dark:bg-[#1a2e1f] z-10 rounded-t-2xl">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-[#e2f5e8]">Add Cash Person</h2>
            <p className="text-xs text-slate-400 dark:text-[#64916e] mt-0.5">Track money received from or paid to this person.</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae]"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#e2f5e8] mb-1.5">
              <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Name <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. Ali Raza"
              className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-[#e2f5e8] ${errors.name ? 'border-rose-400 bg-rose-50' : 'border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119]'}`}
            />
            {errors.name && <p className="mt-1 text-xs text-rose-500">{errors.name}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#e2f5e8] mb-1.5">
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Phone Number</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={set('phone')}
              placeholder="e.g. 03001234567"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#e2f5e8] mb-1.5">
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Address</span>
            </label>
            <input
              type="text"
              value={form.address}
              onChange={set('address')}
              placeholder="Street, City"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Type + Customer Type — 2 col */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#e2f5e8] mb-1.5">
                <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Type <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={form.type}
                onChange={set('type')}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-[#e2f5e8] ${errors.type ? 'border-rose-400 bg-rose-50' : 'border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119]'}`}
              >
                <option value="">Select cash flow…</option>
                <option value="Incoming">Incoming (Money we receive / lena hai)</option>
                <option value="Outgoing">Outgoing (Money we pay / dena hai)</option>
              </select>
              {errors.type && <p className="mt-1 text-xs text-rose-500">{errors.type}</p>}
            </div>

            {/* Customer Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-[#e2f5e8] mb-1.5">
                <span className="flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5" /> Person Role <span className="text-rose-500">*</span></span>
              </label>
              <select
                value={form.customerType}
                onChange={set('customerType')}
                className={`w-full px-3.5 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-[#e2f5e8] ${errors.customerType ? 'border-rose-400 bg-rose-50' : 'border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119]'}`}
              >
                <option value="">Select role…</option>
                <option value="Debtor">They will pay us (Customer / Borrower)</option>
                <option value="Creditor">We will pay them (Supplier / Lender)</option>
              </select>
              {errors.customerType && <p className="mt-1 text-xs text-rose-500">{errors.customerType}</p>}
            </div>
          </div>

          {/* Role help text */}
          {(form.type || form.customerType) && (
            <div className="flex items-start gap-2.5 bg-blue-50/80 border border-blue-100 rounded-xl p-3">
              <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700 leading-relaxed">
                {form.customerType === 'Debtor' &&
                  'They owe money to our shop. We will collect / receive money from them.'}
                {form.customerType === 'Creditor' &&
                  'Our shop owes money to them. We need to pay them.'}
                {!form.customerType &&
                  'Select a person role to see their account description.'}
              </p>
            </div>
          )}

          {/* Opening Balance */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#e2f5e8] mb-1.5">
              <span className="flex items-center gap-1.5"><DollarSign className="w-3.5 h-3.5" /> Opening Balance <span className="text-rose-500">*</span></span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-[#64916e] text-sm font-medium pointer-events-none">Rs.</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.openingBalance}
                onChange={set('openingBalance')}
                placeholder="0"
                className={`w-full pl-12 pr-4 py-2.5 rounded-xl border text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-800 dark:text-[#e2f5e8] ${errors.openingBalance ? 'border-rose-400 bg-rose-50' : 'border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119]'}`}
              />
            </div>
            {errors.openingBalance && <p className="mt-1 text-xs text-rose-500">{errors.openingBalance}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-[#e2f5e8] mb-1.5">
              <span className="flex items-center gap-1.5"><AlignLeft className="w-3.5 h-3.5" /> Description</span>
            </label>
            <textarea
              value={form.description}
              onChange={set('description')}
              rows={2}
              placeholder="Optional note…"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] text-sm text-slate-800 dark:text-[#e2f5e8] resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 dark:border-[#2d4a35]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-xl transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-xl shadow-sm shadow-blue-600/20 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                'Create Cash Person'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
