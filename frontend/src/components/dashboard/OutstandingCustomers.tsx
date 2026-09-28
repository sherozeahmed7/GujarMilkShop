import React from 'react';
import { ChevronRight, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import { DateFilterType } from '../../types';
import { KhataCustomer } from '../../hooks/useDashboardData';

interface OutstandingCustomersProps {
  dateFilter: DateFilterType;
  customers: KhataCustomer[];
}

export const OutstandingCustomers: React.FC<OutstandingCustomersProps> = ({ dateFilter, customers }) => {
  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-[#e2f5e8] flex items-center gap-2">
            Outstanding Khata
          </h3>
          <p className="text-sm text-slate-500 dark:text-[#64916e]">Top balances due</p>
        </div>
        <button className="text-sm font-medium text-[#166534] dark:text-[#22c55e] hover:text-[#14532d] dark:hover:text-[#86efac] flex items-center gap-1 transition-colors">
          View All <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        {customers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-10 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-[#64916e]">All clear!</p>
            <p className="text-xs text-slate-400 dark:text-[#496b50] mt-1">No outstanding Khata balances.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {customers.map((customer) => (
            <li key={customer.id} className="flex justify-between items-center p-3 border border-slate-100 dark:border-[#2d4a35] rounded-xl hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
              <div className="flex gap-3 items-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-[#1e3124] flex items-center justify-center text-slate-500 dark:text-[#7aab84] font-bold">
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-slate-800 dark:text-[#e2f5e8] text-sm flex items-center gap-2">
                    {customer.name}
                    <span className="text-[9px] uppercase tracking-wider bg-slate-200 dark:bg-[#2d4a35] text-slate-600 dark:text-[#7aab84] px-1.5 py-0.5 rounded-sm">
                      {customer.type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-[#64916e] flex items-center gap-1 mt-0.5">
                    {customer.phone}
                  </div>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="font-bold text-slate-800 dark:text-[#e2f5e8] text-sm">Rs. {customer.amount.toLocaleString()}</div>
                <div className={`text-[10px] font-bold flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-sm ${
                  customer.status === 'Overdue' ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400' :
                  customer.status === 'Due Soon' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                }`}>
                  {customer.status === 'Overdue' ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {customer.status}
                </div>
              </div>
            </li>
          ))}
        </ul>
        )}
      </div>
    </div>
  );
};
