import React from 'react';
import { Activity } from 'lucide-react';
import { DateFilterType } from '../../types';
import { RecentSaleRow } from '../../hooks/useDashboardData';

const mockSales = [
  { id: 1, type: 'Walk-in', time: '11:40', amount: 'Rs. 240', payment: 'CASH' },
  { id: 2, type: 'Walk-in', time: '11:32', amount: 'Rs. 1,000', payment: 'CASH' },
];

interface RecentSalesProps {
  dateFilter: DateFilterType;
  sales: RecentSaleRow[];
}

export const RecentSales: React.FC<RecentSalesProps> = ({ dateFilter, sales }) => {
  const PAYMENT_STYLES: Record<RecentSaleRow['payment'], string> = {
    CASH:   'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30',
    ONLINE: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30',
    KHATA:  'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30',
  };

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col h-full">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-[#e2f5e8]">Recent Sales</h3>
          <p className="text-sm text-slate-500 dark:text-[#64916e]">Latest bills — {dateFilter.label.toLowerCase()}</p>
        </div>
        <Activity className="w-5 h-5 text-slate-400 dark:text-[#64916e]" />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {sales.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-[#64916e] text-center mt-8">No sales for this period.</p>
        ) : (
          <ul className="space-y-3">
            {sales.map((sale) => (
              <li key={sale.id} className="flex justify-between items-center py-2 border-b border-slate-50 dark:border-[#1e3124] last:border-0">
                <div>
                  <div className="font-bold text-slate-800 dark:text-[#e2f5e8] text-sm">{sale.type}</div>
                  <div className="text-xs text-slate-500 dark:text-[#64916e] mt-0.5">{sale.timeLabel}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800 dark:text-[#e2f5e8] text-sm">Rs. {sale.amount.toLocaleString()}</div>
                  <div className={`text-[10px] font-bold mt-0.5 px-1.5 py-0.5 rounded-sm inline-block ${PAYMENT_STYLES[sale.payment]}`}>
                    {sale.payment}
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
