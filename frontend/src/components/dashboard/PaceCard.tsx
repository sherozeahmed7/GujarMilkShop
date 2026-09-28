import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { DateFilterType } from '../../types';

interface PaceCardProps {
  dateFilter: DateFilterType;
  billsServed: number;
  averageBill: number;
}

export const PaceCard: React.FC<PaceCardProps> = ({ dateFilter, billsServed, averageBill }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col justify-between">
      <div className="mb-4">
        <h3 className="text-xs font-bold text-slate-500 dark:text-[#64916e] uppercase tracking-wider mb-4">{dateFilter.label}'s Pace</h3>
        <div className="flex justify-between items-end">
          <div>
            <div className="text-3xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">{billsServed.toLocaleString()}</div>
            <div className="text-sm text-slate-500 dark:text-[#64916e] mt-1">Bills served</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-[#166534] dark:text-[#22c55e] tracking-tight">Rs. {averageBill.toLocaleString()}</div>
            <div className="text-sm text-slate-500 dark:text-[#64916e] mt-1">Average bill</div>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={() => navigate('/pos')}
        className="w-full bg-[#166534] dark:bg-[#22c55e] hover:bg-[#14532d] dark:hover:bg-[#16a34a] active:bg-[#0f3d21] dark:active:bg-[#15803d] text-white dark:text-[#0d1a10] py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-md shadow-[#166534]/25 dark:shadow-[#22c55e]/20"
      >
        <ShoppingCart className="w-5 h-5" />
        <span>New Sale &rarr;</span>
      </button>
    </div>
  );
};
