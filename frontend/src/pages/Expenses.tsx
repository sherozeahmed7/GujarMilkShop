import React, { useEffect } from 'react';
import { useExpenseStore } from '../store/expenseStore';
import { ExpenseForm } from '../components/expenses/ExpenseForm';
import { ExpenseSummary } from '../components/expenses/ExpenseSummary';
import { ExpenseHistory } from '../components/expenses/ExpenseHistory';
import { CostBreakdown } from '../components/expenses/CostBreakdown';
import { Wallet, Info } from 'lucide-react';

export const Expenses: React.FC = () => {
  const { fetchExpenses, isLoading, error, clearError } = useExpenseStore();

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return (
    <div className="flex flex-col gap-6 relative">
      {error && (
        <div className="flex items-center justify-between gap-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 rounded-xl px-4 py-3 text-sm font-medium">
          <span>{error}</span>
          <button onClick={clearError} className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-bold">✕</button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-[#1a2e1f] border border-slate-100 dark:border-[#2d4a35] rounded-xl px-4 py-3 shadow-sm">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          Loading expenses…
        </div>
      )}
      {/* Header handled by Layout, we just need the page content */}
      
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column - Main Content */}
        <div className="xl:col-span-2 flex flex-col gap-6">
          <ExpenseForm />
          <ExpenseSummary />
          <ExpenseHistory />
        </div>
        
        {/* Right Column - Side Panels */}
        <div className="flex flex-col gap-6">
          <CostBreakdown />
          
          {/* Owner Notes */}
          <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Owner Notes</h3>
            </div>
            
            <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li className="flex gap-2 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0"></div>
                <span>Shopping bags are tracked separately because they quietly eat margin on small sales.</span>
              </li>
              <li className="flex gap-2 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1.5 flex-shrink-0"></div>
                <span>Utility bills are split into electricity, WASA, and gas so monthly pressure is visible.</span>
              </li>
              <li className="flex gap-2 items-start">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 flex-shrink-0"></div>
                <span>If one category crosses 35% of visible expense, review supplier price or wastage.</span>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  );
};
