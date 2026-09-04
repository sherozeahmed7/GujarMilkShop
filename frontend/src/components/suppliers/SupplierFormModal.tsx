import React, { useState } from 'react';
import { Supplier, CycleType } from '../../types';
import { useSupplierStore } from '../../store/supplierStore';
import { X, UserPlus, Edit2 } from 'lucide-react';

interface SupplierFormModalProps {
  supplier?: Supplier; // If provided, we are editing
  onClose: () => void;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({ supplier, onClose }) => {
  const { addSupplier, updateSupplier } = useSupplierStore();
  
  const [name, setName] = useState(supplier?.name || '');
  const [code, setCode] = useState(supplier?.code || '');
  const [phone, setPhone] = useState(supplier?.phone || '');
  const [defaultRate, setDefaultRate] = useState(supplier?.defaultRate.toString() || '180');
  const [cowRate, setCowRate] = useState(supplier?.cowRate.toString() || '180');
  const [buffaloRate, setBuffaloRate] = useState(supplier?.buffaloRate.toString() || '180');
  const [cycleType, setCycleType] = useState<CycleType>(supplier?.cycleType || 'Monthly Cycle');
  const [isActive, setIsActive] = useState(supplier ? supplier.isActive : true);
  const [guaranteedAdvance, setGuaranteedAdvance] = useState(supplier?.guaranteedAdvance.toString() || '0');
  const [openingBalance, setOpeningBalance] = useState(
    supplier?.openingBalance !== undefined && supplier?.openingBalance !== null
      ? String(supplier.openingBalance)
      : ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const opening = openingBalance.trim() === '' ? 0 : Number(openingBalance);
    if (Number.isNaN(opening) || opening < 0) {
      return;
    }

    const supplierData = {
      name,
      code,
      phone,
      defaultRate: parseFloat(defaultRate) || 0,
      cowRate: parseFloat(cowRate) || 0,
      buffaloRate: parseFloat(buffaloRate) || 0,
      cycleType,
      isActive,
      guaranteedAdvance: parseFloat(guaranteedAdvance) || 0,
    };

    if (supplier) {
      updateSupplier(supplier.id, supplierData);
    } else {
      addSupplier({
        ...supplierData,
        ...(opening > 0 ? { openingBalance: opening } : {}),
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
              {supplier ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{supplier ? 'Edit Supplier' : 'Add New Supplier'}</h3>
              <p className="text-xs font-medium text-slate-500">Enter farm and rate details</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar">
          <form id="supplier-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Supplier Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Supplier Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. SUP-0001"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Payment Cycle</label>
                <select 
                  value={cycleType} 
                  onChange={(e) => setCycleType(e.target.value as CycleType)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1-Day Cycle">1-Day Cycle</option>
                  <option value="Weekly Cycle">Weekly Cycle</option>
                  <option value="Monthly Cycle">Monthly Cycle</option>
                </select>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 flex flex-col gap-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rate Settings (Rs/KG)</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Default Rate</label>
                  <input
                    type="number"
                    value={defaultRate}
                    onChange={(e) => setDefaultRate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cow Rate</label>
                  <input
                    type="number"
                    value={cowRate}
                    onChange={(e) => setCowRate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Buffalo Rate</label>
                  <input
                    type="number"
                    value={buffaloRate}
                    onChange={(e) => setBuffaloRate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            {!supplier && (
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
                  placeholder="e.g. 5000 — amount already owed to supplier"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-400">
                  Use this for existing suppliers with unpaid dues before the system. Shows under Previous / Remaining.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">Guaranteed Advance (Rs)</label>
                <input
                  type="number"
                  value={guaranteedAdvance}
                  onChange={(e) => setGuaranteedAdvance(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-slate-700">Active Supplier</span>
                </label>
              </div>
            </div>

          </form>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 flex-shrink-0 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-100 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="supplier-form"
            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            {supplier ? 'Save Changes' : 'Add Supplier'}
          </button>
        </div>

      </div>
    </div>
  );
};
