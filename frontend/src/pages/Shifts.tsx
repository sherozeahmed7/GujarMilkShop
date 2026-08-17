import React from 'react';
import { RefreshCw } from 'lucide-react';
import { CurrentShiftPanel } from '../components/shifts/CurrentShiftPanel';
import { ShiftHistoryPanel } from '../components/shifts/ShiftHistoryPanel';
import { useShiftStore } from '../store/shiftStore';

export const Shifts: React.FC = () => {
  const { refreshData } = useShiftStore();

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      {/* Page Header */}
      <div className="flex items-start justify-between flex-shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Shift Management</h1>
          <p className="text-slate-500 text-sm mt-1">
            Track who opened, who closed, expected cash, counted cash, and cash difference for the shop day.
          </p>
        </div>
        <button
          onClick={refreshData}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Main Content Layout */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left: Current Shift Form / Details */}
        <div className="w-[45%] flex-shrink-0 min-h-0 flex flex-col overflow-hidden">
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
