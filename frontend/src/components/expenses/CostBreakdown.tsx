import React from 'react';
import { useExpenseStore } from '../../store/expenseStore';

export const CostBreakdown: React.FC = () => {
  const { breakdown } = useExpenseStore();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <h3 className="font-bold text-slate-800 mb-4">Cost Breakdown</h3>
      
      {breakdown.length === 0 ? (
        <div className="text-sm text-slate-500 py-4 text-center">
          No expense data this month.
        </div>
      ) : (
        <div className="space-y-4">
          {breakdown.map((item, index) => (
            <div key={index} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium text-slate-700">{item.category}</span>
                <span className="font-bold text-slate-900">
                  Rs. {item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full" 
                  style={{ width: `${item.percentage}%` }}
                ></div>
              </div>
              <div className="text-[10px] text-slate-500 text-right">
                {item.percentage}%
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
