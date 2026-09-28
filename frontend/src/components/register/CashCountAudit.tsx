import React from 'react';
import { Scale, Calculator } from 'lucide-react';
import { useRegisterStore } from '../../store/registerStore';

interface CashCountAuditProps {
  onCountCashClick: () => void;
}

export const CashCountAudit: React.FC<CashCountAuditProps> = ({ onCountCashClick }) => {
  const { currentRegister } = useRegisterStore();
  const isClosed = !currentRegister || currentRegister.status === 'CLOSED';
  const buttonLabel = currentRegister?.status === 'COUNTED' ? 'Recount Cash' : 'Count Cash';

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Scale className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Cash Count Audit</h3>
          <p className="text-slate-500 text-sm mt-0.5 max-w-2xl">
            At closing, count the real cash in the drawer. The app will show extra or short cash against expected sales cash.
          </p>
        </div>
      </div>
      
      <button
        onClick={onCountCashClick}
        disabled={isClosed}
        className="flex-shrink-0 flex items-center gap-2 px-6 py-2.5 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] hover:border-blue-400 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 dark:text-[#e2f5e8] text-sm font-bold rounded-xl shadow-sm transition-all"
      >
        <Calculator className="w-4 h-4" />
        {buttonLabel}
      </button>
    </div>
  );
};
