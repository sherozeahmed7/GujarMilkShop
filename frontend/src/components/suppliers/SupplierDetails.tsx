import React, { useState } from 'react';
import { Supplier } from '../../types';
import { DailyCollections } from './DailyCollections';
import { CycleReport } from './CycleReport';
import { Edit2, CreditCard, AlertCircle } from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { SupplierFormModal } from './SupplierFormModal';

interface SupplierDetailsProps {
  supplier: Supplier;
}

export const SupplierDetails: React.FC<SupplierDetailsProps> = ({ supplier }) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'cycle'>('daily');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  return (
    <div className="flex flex-col h-full bg-slate-50/30">
      {/* Header Section */}
      <div className="bg-white border-b border-slate-100 p-5 flex flex-col gap-4 flex-shrink-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-800">{supplier.name}</h2>
              <button 
                onClick={() => setIsEditModalOpen(true)}
                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500 font-medium">
              <span>{supplier.code}</span>
              {supplier.phone && <span>{supplier.phone}</span>}
              <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                {supplier.cycleType}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${supplier.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {supplier.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-end gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total to Pay</span>
                <span className="text-sm font-bold text-slate-700">
                  Rs. {(supplier.totalAmount ?? (supplier.currentAmount ?? 0) + (supplier.previousAmount ?? 0)).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Paid</span>
                <span className="text-sm font-bold text-emerald-600">
                  Rs. {(supplier.paidAmount ?? 0).toLocaleString()}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Remaining</span>
                <span
                  className={`text-2xl font-bold ${
                    supplier.payableBalance < 0 ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {supplier.payableBalance < 0
                    ? `Rs. −${Math.abs(supplier.payableBalance).toLocaleString()}`
                    : `Rs. ${supplier.payableBalance.toLocaleString()}`}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={supplier.payableBalance <= 0}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CreditCard className="w-5 h-5" />
              Pay
            </button>
          </div>
        </div>

        <div className="flex items-center gap-6 mt-2">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Default Rate</span>
            <span className="text-sm font-semibold text-slate-700">Rs. {supplier.defaultRate}</span>
          </div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cow Rate</span>
            <span className="text-sm font-semibold text-slate-700">Rs. {supplier.cowRate}</span>
          </div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Buffalo Rate</span>
            <span className="text-sm font-semibold text-slate-700">Rs. {supplier.buffaloRate}</span>
          </div>
          <div className="w-px h-6 bg-slate-200"></div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg border border-emerald-100">
            <AlertCircle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">
              Advance: −Rs. {(supplier.guaranteedAdvance || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-5 bg-white flex-shrink-0">
        <button
          onClick={() => setActiveTab('daily')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'daily' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Daily Collections
        </button>
        <button
          onClick={() => setActiveTab('cycle')}
          className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${
            activeTab === 'cycle' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          Cycle Report & Statement
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'daily' && <DailyCollections supplier={supplier} />}
        {activeTab === 'cycle' && <CycleReport supplier={supplier} />}
      </div>

      {isPaymentModalOpen && (
        <PaymentModal 
          supplier={supplier} 
          onClose={() => setIsPaymentModalOpen(false)} 
        />
      )}

      {isEditModalOpen && (
        <SupplierFormModal 
          supplier={supplier} 
          onClose={() => setIsEditModalOpen(false)} 
        />
      )}
    </div>
  );
};
