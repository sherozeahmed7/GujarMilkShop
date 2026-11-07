import React, { useEffect, useState } from 'react';
import { useExpenseStore } from '../store/expenseStore';
import { ExpenseForm } from '../components/expenses/ExpenseForm';
import { ExpenseSummary } from '../components/expenses/ExpenseSummary';
import { ExpenseHistory } from '../components/expenses/ExpenseHistory';
import { CostBreakdown } from '../components/expenses/CostBreakdown';
import { PersonalExpensesSection } from '../components/expenses/PersonalExpensesSection';
import { CustomerExpensesSection } from '../components/expenses/CustomerExpensesSection';
import { Wallet, Info, Store, User, Users } from 'lucide-react';

export const Expenses: React.FC = () => {
  const [expenseSection, setExpenseSection] = useState<'shop' | 'personal' | 'customer'>('shop');
  const { fetchExpenses, isLoading, error, clearError } = useExpenseStore();

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  return (
    <div className="flex flex-col gap-6 relative">
      {/* ── Section Switch: Shop Expenses | Personal Expenses | Customers ── */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-200/70 dark:bg-[#142119] rounded-2xl w-full sm:w-fit border border-slate-300/60 dark:border-[#2d4a35]">
        <button
          type="button"
          onClick={() => setExpenseSection('shop')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            expenseSection === 'shop'
              ? 'bg-white dark:bg-[#1a2e1f] text-slate-900 dark:text-[#e2f5e8] shadow-sm'
              : 'text-slate-600 dark:text-[#8ba895] hover:text-slate-900 dark:hover:text-[#e2f5e8]'
          }`}
        >
          <Store className="w-4 h-4 text-blue-500" />
          <span>Shop Expenses</span>
        </button>
        <button
          type="button"
          onClick={() => setExpenseSection('personal')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            expenseSection === 'personal'
              ? 'bg-white dark:bg-[#1a2e1f] text-slate-900 dark:text-[#e2f5e8] shadow-sm'
              : 'text-slate-600 dark:text-[#8ba895] hover:text-slate-900 dark:hover:text-[#e2f5e8]'
          }`}
        >
          <User className="w-4 h-4 text-emerald-500" />
          <span>Personal Expenses</span>
        </button>
        <button
          type="button"
          onClick={() => setExpenseSection('customer')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
            expenseSection === 'customer'
              ? 'bg-white dark:bg-[#1a2e1f] text-slate-900 dark:text-[#e2f5e8] shadow-sm'
              : 'text-slate-600 dark:text-[#8ba895] hover:text-slate-900 dark:hover:text-[#e2f5e8]'
          }`}
        >
          <Users className="w-4 h-4 text-purple-500" />
          <span>Customers</span>
        </button>
      </div>

      {expenseSection === 'personal' ? (
        <PersonalExpensesSection />
      ) : expenseSection === 'customer' ? (
        <CustomerExpensesSection />
      ) : (
        <>
          {error && (
            <div className="flex items-center justify-between gap-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 rounded-xl px-4 py-3 text-sm font-medium">
              <span>{error}</span>
              <button onClick={clearError} className="text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-bold">✕</button>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 bg-white dark:bg-[#1a2e1f] border border-slate-100 dark:border-[#2d4a35] rounded-xl px-4 py-3 shadow-sm">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              Loading shop expenses…
            </div>
          )}

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
        </>
      )}
    </div>
  );
};
