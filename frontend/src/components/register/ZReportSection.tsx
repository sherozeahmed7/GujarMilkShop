import React from 'react';
import { RegisterStatus, DifferenceStatus } from '../../types';
import { useRegisterStore } from '../../store/registerStore';

const statusColors: Record<RegisterStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  COUNTED: 'bg-amber-100 text-amber-700',
  CLOSED: 'bg-emerald-100 text-emerald-700',
};

const diffColors: Record<DifferenceStatus, string> = {
  Balanced: 'text-emerald-600 bg-emerald-50',
  Short: 'text-rose-600 bg-rose-50',
  Over: 'text-amber-600 bg-amber-50',
};

function formatTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export const ZReportSection: React.FC = () => {
  const { currentRegister: data, registerHistory } = useRegisterStore();

  // Show most recent closed shift when no shift is open
  const display = data ?? registerHistory[0] ?? null;

  if (!display) {
    return (
      <div id="z-report-section" className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-100 dark:border-[#2d4a35] shadow-sm p-6">
        <p className="text-sm text-slate-400 text-center">No shift data available yet.</p>
      </div>
    );
  }

  return (
    <div id="z-report-section" className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-100 dark:border-[#2d4a35] shadow-sm p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="font-bold text-slate-800 tracking-tight">Z-Report / End of Day Closing</h2>
          <p className="text-xs text-slate-500 mt-1">Accountant-ready closing summary for {display.date}</p>
        </div>
        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-widest ${statusColors[display.status]}`}>
          {display.status}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-y-6 gap-x-8 text-sm">
        {/* Row 1 */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cashier</p>
          <p className="font-semibold text-slate-800">{display.cashier}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Opening Cash</p>
          <p className="font-semibold text-slate-800">Rs. {display.openingBalance.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cash Sales</p>
          <p className="font-semibold text-emerald-600">+Rs. {display.cashSales.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expenses</p>
          <p className="font-semibold text-rose-600">-Rs. {display.expenses.toLocaleString()}</p>
        </div>

        {/* Row 2 */}
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected Cash</p>
          <p className="font-bold text-slate-800">Rs. {display.expectedCash.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Counted Cash</p>
          <p className="font-bold text-slate-800">
            {display.countedCash !== undefined ? `Rs. ${display.countedCash.toLocaleString()}` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Variance</p>
          {display.variance !== undefined ? (
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800">
                Rs. {display.variance.toLocaleString()}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${diffColors[display.differenceStatus!]}`}>
                {display.differenceStatus}
              </span>
            </div>
          ) : (
            <p className="font-bold text-slate-400">—</p>
          )}
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Times</p>
          <div className="flex flex-col text-xs text-slate-600 font-medium">
            <span>Opened: {formatTime(display.shiftOpen)}</span>
            <span>Closed: {formatTime(display.shiftClose)}</span>
          </div>
        </div>
      </div>
      
      {/* Notes */}
      {display.notes && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-slate-700">{display.notes}</p>
        </div>
      )}
    </div>
  );
};
