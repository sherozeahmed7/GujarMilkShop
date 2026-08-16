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
    { label: 'Total Sales',     value: fmt(metrics.netSales),      icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Total Expenses',  value: fmt(metrics.totalExpenses),  icon: Receipt,    color: 'text-rose-600',   bg: 'bg-rose-50'    },
    { label: 'Total Bills',     value: metrics.totalBills.toLocaleString(), icon: Activity,   color: 'text-blue-600',   bg: 'bg-blue-50'    },
    { label: 'Returns',         value: fmt(metrics.returns),        icon: Undo2,      color: 'text-orange-600', bg: 'bg-orange-50'  },
    { label: 'Credit Added',    value: fmt(metrics.creditAdded),    icon: CreditCard, color: 'text-indigo-600', bg: 'bg-indigo-50'  },
    { label: 'Sale (KG)',       value: `${metrics.totalSaleKg.toLocaleString()} KG`, icon: Scale, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Average Bill',    value: fmt(metrics.averageBill),    icon: Calculator, color: 'text-amber-600',  bg: 'bg-amber-50'   },
    { label: 'Pending Credit',  value: fmt(metrics.pendingCredit),  icon: Clock,      color: 'text-purple-600', bg: 'bg-purple-50'  },
  ];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 h-full">
      <div className="mb-6">
        <h3 className="text-base font-bold text-slate-800">
          <span className="text-blue-600">{dateFilter.label}</span>'s Analysis
        </h3>
        <p className="text-sm text-slate-500">Operational metrics for the selected period</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-slate-50 hover:bg-slate-50 transition-colors">
            <div className={`p-2.5 rounded-lg ${item.bg} shrink-0`}>
              <item.icon className={`w-5 h-5 ${item.color}`} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium text-slate-500 truncate">{item.label}</div>
              <div className="text-sm font-bold text-slate-800 truncate">{item.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
