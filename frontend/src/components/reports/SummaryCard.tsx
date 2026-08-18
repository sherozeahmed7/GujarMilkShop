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
  valueColor = 'text-slate-800'
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <h4 className="text-sm font-semibold text-slate-500">{title}</h4>
        {Icon && <Icon className="w-5 h-5 text-slate-400" />}
      </div>
      
      <div>
        <div className={`text-2xl font-bold ${valueColor}`}>
          {value}
        </div>
        
        <div className="flex items-center gap-2 mt-1">
          {trend !== undefined && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${trend >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
          )}
          {subtitle && (
            <span className="text-xs text-slate-400">{subtitle}</span>
          )}
        </div>
      </div>
    </div>
  );
};
