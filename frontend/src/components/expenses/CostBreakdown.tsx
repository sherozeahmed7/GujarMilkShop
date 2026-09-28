import React from 'react';
import { useExpenseStore } from '../../store/expenseStore';

export const CostBreakdown: React.FC = () => {
  const { breakdown } = useExpenseStore();

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5">
      <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] mb-4">Cost Breakdown</h3>
      
      {breakdown.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">
          No expense data this month.
        </div>
      ) : (
        <div className="space-y-4">
          {breakdown.map((item, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-slate-700 dark:text-[#e2f5e8]">{item.category}</span>
                <span className="font-bold text-slate-900 dark:text-[#e2f5e8]">
                  Rs. {item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-[#142119] rounded-full h-2">
                <div 
                  className="bg-blue-500 dark:bg-[#22c55e] h-2 rounded-full" 
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 text-right">
                {item.percentage}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
