import React from 'react';
import { X } from 'lucide-react';
import { Supplier } from '../../types';
import { CycleReport } from '../suppliers/CycleReport';
import { PaymentModal } from '../suppliers/PaymentModal';

interface SupplierLedgerModalProps { supplier: Supplier; onClose: () => void; }

export const SupplierLedgerModal: React.FC<SupplierLedgerModalProps> = ({ supplier, onClose }) => {
  const [paying, setPaying] = React.useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div><h2 className="text-lg font-bold text-slate-800">{supplier.name}</h2><p className="text-xs text-slate-500">Supplier ledger · {supplier.code}</p></div>
          <div className="flex items-center gap-3"><button onClick={() => setPaying(true)} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold">Pay Supplier</button><button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg" title="Close"><X className="w-5 h-5" /></button></div>
        </div>
        <div className="flex-1 overflow-y-auto"><CycleReport supplier={supplier} /></div>
      </div>
      {paying && <PaymentModal supplier={supplier} onClose={() => { setPaying(false); onClose(); }} />}
    </div>
  );
};
