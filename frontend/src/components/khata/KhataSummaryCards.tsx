import React from 'react';
import { BookOpen, DollarSign, CheckCircle } from 'lucide-react';
import { useCustomerStore } from '../../store/customerStore';

export const KhataSummaryCards: React.FC = () => {
  const { customers, transactions } = useCustomerStore();

  const khataAccounts = customers.length;
  const totalOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);

  // Collected today: sum of payments made today
  const today = new Date().toISOString().split('T')[0];
  const collectedToday = transactions
    .filter(t => t.type === 'Payment' && t.date === today)
    .reduce((sum, t) => sum + t.amount, 0);

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  return (
    <div className="grid grid-cols-3 gap-5">
      {/* Khata Accounts */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khata Accounts</p>
          <h3 className="text-3xl font-bold text-slate-800 mt-1">{khataAccounts}</h3>
        </div>
      </div>

      {/* Total Outstanding */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-rose-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 flex-shrink-0">
          <DollarSign className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Total Outstanding</p>
          <h3 className="text-2xl font-bold text-rose-600 mt-1">{formatCurrency(totalOutstanding)}</h3>
        </div>
      </div>

      {/* Collected Today */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
          <CheckCircle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Collected Today</p>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(collectedToday)}</h3>
        </div>
      </div>
    </div>
  );
};
