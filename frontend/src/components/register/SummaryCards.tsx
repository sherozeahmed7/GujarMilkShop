import React from 'react';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { useRegisterStore } from '../../store/registerStore';

export const SummaryCards: React.FC = () => {
  const { currentRegister } = useRegisterStore();
  if (!currentRegister) return null;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Opening Balance */}
      <div className="bg-white dark:bg-[#1a2e1f] border-2 border-blue-100 dark:border-[#2d4a35] rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-5 text-blue-500">
          <Wallet className="w-24 h-24" />
        </div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Opening Balance</p>
        <p className="text-2xl font-bold text-slate-800">Rs. {currentRegister.openingBalance.toLocaleString()}</p>
      </div>

      {/* Cash In */}
      <div className="bg-white dark:bg-[#1a2e1f] border-2 border-emerald-100 dark:border-[#2d4a35] rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-5 text-emerald-500">
          <TrendingUp className="w-24 h-24" />
        </div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cash In (Sales/Khata)</p>
        <p className="text-2xl font-bold text-emerald-600">+Rs. {currentRegister.cashSales.toLocaleString()}</p>
      </div>

      {/* Cash Out */}
      <div className="bg-white dark:bg-[#1a2e1f] border-2 border-rose-100 dark:border-[#2d4a35] rounded-2xl p-5 shadow-sm flex flex-col justify-between relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-5 text-rose-500">
          <TrendingDown className="w-24 h-24" />
        </div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Cash Out (Expenses/Refunds)</p>
        <p className="text-2xl font-bold text-rose-600">-Rs. {currentRegister.expenses.toLocaleString()}</p>
      </div>
    </div>
  );
};
