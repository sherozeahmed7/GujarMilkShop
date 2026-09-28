  import React from 'react';
  import { Calendar, RefreshCw } from 'lucide-react';
  import { DateFilterType } from '../../types';

  interface WelcomeCardProps {
    dateFilter: DateFilterType;
    grossSales: number;
    refunds: number;
    netSales: number;
    periodSummary: string;
    isLoading?: boolean;
    onRefresh?: () => void;
  }

  export const WelcomeCard: React.FC<WelcomeCardProps> = ({
    dateFilter,
    grossSales,
    refunds,
    netSales,
    periodSummary,
    isLoading = false,
    onRefresh,
  }) => {
    const fmt = (n: number) =>
      n >= 100000 ? `Rs. ${(n / 100000).toFixed(1)}L` : `Rs. ${n.toLocaleString()}`;

    const rawName = localStorage.getItem('userName') || '';
    const role = localStorage.getItem('role') || 'user';
    const userName = rawName && rawName !== 'User' ? rawName : role;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

    return (
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-6 shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col justify-between">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 text-slate-500 dark:text-[#64916e] text-sm mb-2">
              <Calendar className="w-4 h-4" />
              <span>{periodSummary}</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">{greeting}, {userName}</h2>
            <p className="text-slate-500 dark:text-[#64916e] text-sm mt-1">
              Live counter summary for{' '}
              <span className="font-medium text-slate-700 dark:text-[#a7c4ae]">{dateFilter.label.toLowerCase()}</span>'s shift.
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 bg-slate-50 dark:bg-[#1e3124] hover:bg-slate-100 dark:hover:bg-[#263d2b] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#a7c4ae] px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#FFFDF5] dark:bg-[#2a1f0a] rounded-xl p-4 border border-[#FDE68A] dark:border-[#3d2f12] shadow-xs">
            <div className="text-xs font-bold text-[#78350F] dark:text-[#fcd34d] uppercase tracking-wider mb-1">Gross</div>
            <div className="text-xl font-black text-[#78350F] dark:text-[#fcd34d]">{fmt(grossSales)}</div>
          </div>
          <div className="bg-[#F8FAFC] dark:bg-[#1e3124] rounded-xl p-4 border border-slate-200/70 dark:border-[#2d4a35] shadow-xs">
            <div className="text-xs font-semibold text-slate-500 dark:text-[#64916e] uppercase tracking-wider mb-1">Refunds</div>
            <div className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">{refunds === 0 ? 'Rs. 0' : fmt(refunds)}</div>
          </div>
          <div className="bg-[#F0FDF4] dark:bg-[#1a3d24] rounded-xl p-4 border border-[#BBF7D0] dark:border-[#2d4a35] shadow-xs">
            <div className="text-xs font-bold text-[#166534] dark:text-[#22c55e] uppercase tracking-wider mb-1">Net</div>
            <div className="text-xl font-black text-[#166534] dark:text-[#22c55e]">{fmt(netSales)}</div>
          </div>
        </div>
      </div>
    );
  };
