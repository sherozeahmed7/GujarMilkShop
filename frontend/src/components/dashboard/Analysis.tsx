import React from 'react';
import { Activity, Calculator, Receipt, DollarSign, Undo2, CreditCard, Scale, Clock } from 'lucide-react';
import { DateFilterType } from '../../types';
import { DashboardMetrics } from '../../hooks/useDashboardData';

interface AnalysisProps {
  dateFilter: DateFilterType;
  metrics: DashboardMetrics;
}

export const Analysis: React.FC<AnalysisProps> = ({ dateFilter, metrics }) => {
  const fmt = (n: number) => `Rs. ${n.toLocaleString()}`;

  const items = [
    { label: 'Total Sales',     value: fmt(metrics.netSales),      icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
    { label: 'Total Expenses',  value: fmt(metrics.totalExpenses),  icon: Receipt,    color: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-50 dark:bg-rose-900/20'       },
    { label: 'Total Bills',     value: metrics.totalBills.toLocaleString(), icon: Activity,   color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-50 dark:bg-blue-900/20'       },
    { label: 'Returns',         value: fmt(metrics.returns),        icon: Undo2,      color: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-50 dark:bg-orange-900/20'   },
    { label: 'Credit Added',    value: fmt(metrics.creditAdded),    icon: CreditCard, color: 'text-indigo-600 dark:text-indigo-400',   bg: 'bg-indigo-50 dark:bg-indigo-900/20'   },
    { label: 'Sale (KG)',       value: `${metrics.totalSaleKg.toLocaleString()} KG`, icon: Scale, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
    { label: 'Average Bill',    value: fmt(metrics.averageBill),    icon: Calculator, color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-50 dark:bg-amber-900/20'     },
    { label: 'Pending Credit',  value: fmt(metrics.pendingCredit),  icon: Clock,      color: 'text-purple-600 dark:text-purple-400',   bg: 'bg-purple-50 dark:bg-purple-900/20'   },
  ];

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-[#2d4a35] h-full">
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-800 dark:text-[#e2f5e8]">
          <span className="text-[#166534] dark:text-[#22c55e]">{dateFilter.label}</span>'s Analysis
        </h3>
        <p className="text-sm text-slate-500 dark:text-[#64916e]">Operational metrics for the selected period</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-slate-50 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
            <div className={`p-2.5 rounded-lg ${item.bg} shrink-0`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 dark:text-[#64916e] truncate">{item.label}</div>
              <div className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] truncate">{item.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
