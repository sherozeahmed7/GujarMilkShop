import React from 'react';
import { Activity } from 'lucide-react';
import { DateFilterType } from '../../types';
import { RecentSaleRow } from '../../hooks/useDashboardData';

interface RecentSalesProps {
  dateFilter: DateFilterType;
  sales: RecentSaleRow[];
}

export const RecentSales: React.FC<RecentSalesProps> = ({ dateFilter, sales }) => {
  const PAYMENT_STYLES: Record<RecentSaleRow['payment'], string> = {
    CASH:   'text-emerald-600 bg-emerald-50',
    ONLINE: 'text-blue-600 bg-blue-50',
    KHATA:  'text-amber-600 bg-amber-50',
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-full">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-base font-bold text-slate-800">Recent Sales</h3>
          <p className="text-sm text-slate-500">Latest bills — {dateFilter.label.toLowerCase()}</p>
        </div>
        <Activity className="w-5 h-5 text-slate-400" />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {sales.length === 0 ? (
          <p className="text-sm text-slate-400 text-center mt-8">No sales for this period.</p>
        ) : (
          <ul className="space-y-3">
            {sales.map((sale) => (
              <li key={sale.id} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-0">
                <div>
                  <div className="font-bold text-slate-800 text-sm">{sale.type}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{sale.timeLabel}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-800 text-sm">Rs. {sale.amount.toLocaleString()}</div>
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
