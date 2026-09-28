import React from 'react';
import { DateFilterType } from '../../types';

interface SummaryCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ElementType;
  trend?: number; // positive or negative percentage
  valueColor?: string;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  trend,
  valueColor = 'text-slate-800 dark:text-[#e2f5e8]'
}) => {
  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-semibold text-slate-500 dark:text-[#8ba895]">{title}</h4>
        {Icon && <Icon className="w-5 h-5 text-slate-400 dark:text-[#64916e]" />}
      </div>
      
      <div>
        <div className={`text-2xl font-bold ${valueColor}`}>
          {value}
        </div>
        
        <div className="flex items-center gap-2 mt-1">
          {trend !== undefined && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${trend >= 0 ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400'}`}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-slate-400 dark:text-slate-500">{subtitle}</span>
          )}
        </div>
      </div>
    </div>
  );
};
