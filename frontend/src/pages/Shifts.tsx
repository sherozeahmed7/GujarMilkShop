import React, { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { CurrentShiftPanel } from '../components/shifts/CurrentShiftPanel';
import { ShiftHistoryPanel } from '../components/shifts/ShiftHistoryPanel';
import { useShiftStore } from '../store/shiftStore';

export const Shifts: React.FC = () => {
  const { refreshData, error } = useShiftStore();

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      {/* Page Header */}
      <div className="flex items-start justify-between flex-shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">Shift Management</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Track who opened, who closed, expected cash, counted cash, and cash difference for the shop day.
          </p>
        </div>
        <button
          onClick={refreshData}
          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#223927] text-slate-700 dark:text-[#e2f5e8] text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      {error && <div className="flex-shrink-0 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">{error}</div>}

      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
        {/* Left: Current Shift Form / Details */}
        <div className="w-full lg:w-[45%] shrink-0 min-h-0 flex flex-col overflow-hidden">
          <CurrentShiftPanel />
        </div>

        {/* Right: Shift History Table */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
           <ShiftHistoryPanel />
        </div>
      </div>
    </div>
  );
};
