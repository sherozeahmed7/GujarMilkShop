import React, { useState } from 'react';
import { Customer } from '../../types';
import { useCustomerStore } from '../../store/customerStore';
import { X, UserPlus, Edit2 } from 'lucide-react';

interface KhataCustomerFormModalProps {
  customer?: Customer;
  onClose: () => void;
}

export const KhataCustomerFormModal: React.FC<KhataCustomerFormModalProps> = ({ customer, onClose }) => {
  const { addCustomer, updateCustomer } = useCustomerStore();

  const [name, setName] = useState(customer?.name || '');
  const [phone, setPhone] = useState(customer?.phone || '');
  const [cardNumber, setCardNumber] = useState(customer?.cardNumber || '');
  const [address, setAddress] = useState(customer?.address || '');
  const [notes, setNotes] = useState(customer?.notes || '');
  const [openingBalance, setOpeningBalance] = useState('0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customer) {
      updateCustomer(customer.id, { name, phone, cardNumber, address, notes });
    } else {
      addCustomer({ name, phone, cardNumber, address, notes, balance: parseFloat(openingBalance) || 0, lastSaleDate: null });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              {customer ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{customer ? 'Edit Customer' : 'New Khata Customer'}</h3>
              <p className="text-xs text-slate-500">Khata / Credit Ledger account</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form id="khata-cust-form" onSubmit={handleSubmit} className="p-5 flex flex-col gap-4 overflow-y-auto">

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Customer Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0300-0000000"
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Card Number</label>
              <input type="text" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {!customer && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Opening Balance (Rs)</label>
              <input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)}
                className="w-full px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm font-bold text-amber-800 focus:ring-2 focus:ring-amber-400" />
              <p className="text-[10px] text-slate-400">Set to 0 if starting fresh</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Address</label>
            <input type="text" value={address} onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 custom-scrollbar" />
          </div>

        </form>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors">
            Cancel
          </button>
          <button type="submit" form="khata-cust-form"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm">
            {customer ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
};
