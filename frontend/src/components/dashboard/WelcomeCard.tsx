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
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 text-slate-500 text-sm mb-2">
              <Calendar className="w-4 h-4" />
              <span>{periodSummary}</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{greeting}, {userName}</h2>
            <p className="text-slate-500 text-sm mt-1">
              Live counter summary for{' '}
              <span className="font-medium text-slate-700">{dateFilter.label.toLowerCase()}</span>'s shift.
            </p>
          </div>
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Refreshing…' : 'Refresh'}</span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#FFFDF5] rounded-xl p-4 border border-[#FDE68A] shadow-xs">
            <div className="text-xs font-bold text-[#78350F] uppercase tracking-wider mb-1">Gross</div>
            <div className="text-xl font-black text-[#78350F]">{fmt(grossSales)}</div>
          </div>
          <div className="bg-[#F8FAFC] rounded-xl p-4 border border-slate-200/70 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Refunds</div>
            <div className="text-xl font-bold text-slate-800">{refunds === 0 ? 'Rs. 0' : fmt(refunds)}</div>
          </div>
          <div className="bg-[#F0FDF4] rounded-xl p-4 border border-[#BBF7D0] shadow-xs">
            <div className="text-xs font-bold text-[#166534] uppercase tracking-wider mb-1">Net</div>
            <div className="text-xl font-black text-[#166534]">{fmt(netSales)}</div>
          </div>
        </div>
      </div>
    );
  };
