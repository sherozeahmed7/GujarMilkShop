import React from 'react';
import { Users, AlertTriangle, DollarSign } from 'lucide-react';

interface CustomerSummaryProps {
  totalCustomers: number;
  totalOutstanding: number;
  withDues: number;
}

export const CustomerSummary: React.FC<CustomerSummaryProps> = ({
  totalCustomers,
  totalOutstanding,
  withDues,
}) => {
  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-[#2d4a35] flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-[#64916e] uppercase tracking-wider">
            Total Rows
          </p>
          <h3 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8]">{totalCustomers}</h3>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-[#2d4a35] flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-900/30 flex items-center justify-center text-rose-600 dark:text-rose-400 flex-shrink-0">
          <DollarSign className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-[#64916e] uppercase tracking-wider">
            Known Outstanding
          </p>
          <h3 className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {formatCurrency(totalOutstanding)}
          </h3>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-[#2d4a35] flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-[#64916e] uppercase tracking-wider">With Dues</p>
          <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">{withDues}</h3>
        </div>
      </div>
    </div>
  );
};
