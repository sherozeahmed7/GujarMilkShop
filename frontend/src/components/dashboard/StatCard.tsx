import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  trendIcon?: LucideIcon;
  bgColor?: string;
  iconColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon,
  trendIcon: TrendIcon,
  bgColor = "bg-white dark:bg-[#1a2e1f]",
  iconColor = "text-slate-400 dark:text-[#64916e]"
}) => {
  return (
    <div className={`${bgColor} rounded-xl p-5 shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col justify-between`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[10px] font-bold text-slate-500 dark:text-[#64916e] uppercase tracking-wider">{title}</h3>
        {TrendIcon && <TrendIcon className={`w-4 h-4 ${iconColor}`} />}
      </div>
      <div>
        <div className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">{value}</div>
        <div className="text-xs text-slate-500 dark:text-[#64916e] mt-1">{subtitle}</div>
      </div>
      <div className="mt-4 flex justify-end">
        <Icon className={`w-5 h-5 ${iconColor} opacity-50`} />
      </div>
    </div>
  );
};
