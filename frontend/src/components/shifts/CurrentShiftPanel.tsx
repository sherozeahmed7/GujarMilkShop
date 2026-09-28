import React, { useState } from 'react';
import { Clock, AlertTriangle, Calculator, PlayCircle, LogOut } from 'lucide-react';
import { useShiftStore } from '../../store/shiftStore';

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

export const CurrentShiftPanel: React.FC = () => {
  const { getCurrentShift, openShift, closeShift } = useShiftStore();
  const currentShift = getCurrentShift();

  // Open Shift Form State
  const [openingCash, setOpeningCash] = useState<string>('');
  const [openingNotes, setOpeningNotes] = useState<string>('');

  // Close Shift Form State
  const [countedCash, setCountedCash] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  
  // Dialogs
  const [showOpenConfirm, setShowOpenConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];
  const isPreviousShiftOpen = currentShift && currentShift.date !== todayStr;

  const handleOpenShift = () => {
    const cash = parseFloat(openingCash);
    if (!isNaN(cash) && cash >= 0) {
      openShift(cash, openingNotes);
      setOpeningCash('');
      setOpeningNotes('');
      setShowOpenConfirm(false);
    }
  };

  const handleCloseShift = () => {
    const cash = parseFloat(countedCash);
    if (!isNaN(cash) && cash >= 0) {
      closeShift(cash, closingNotes);
      setCountedCash('');
      setClosingNotes('');
      setShowCloseConfirm(false);
    }
  };

  // Difference Calculation
  const parsedCounted = parseFloat(countedCash) || 0;
  const difference = currentShift ? parsedCounted - currentShift.expectedCash : 0;
  
  let diffColor = 'text-slate-800';
  let diffBadge = 'Balanced';
  let diffBadgeClass = 'bg-slate-100 text-slate-700';

  if (difference < 0) {
    diffColor = 'text-rose-600';
    diffBadge = 'Short';
    diffBadgeClass = 'bg-rose-100 text-rose-700';
  } else if (difference > 0) {
    diffColor = 'text-emerald-600';
    diffBadge = 'Over';
    diffBadgeClass = 'bg-emerald-100 text-emerald-700';
  }

  // If no shift is open
  if (!currentShift) {
    return (
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-100 dark:border-[#2d4a35] shadow-sm flex flex-col overflow-hidden h-full">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500 dark:text-[#86efac]" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] uppercase tracking-wider">Start a New Shift</h2>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 flex flex-col justify-center gap-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-[#223927] mx-auto flex items-center justify-center mb-4">
              <PlayCircle className="w-8 h-8 text-blue-500 dark:text-[#22c55e]" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">No shift is currently open.</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Enter the opening cash balance to start today's shift.</p>
          </div>

          <div className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-5 space-y-4 max-w-sm mx-auto w-full">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Opening Cash</label>
              <input
                type="number"
                min={0}
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="Enter amount..."
                className="w-full border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-[#e2f5e8] bg-white dark:bg-[#1a2e1f] focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Notes (Optional)</label>
              <textarea
                value={openingNotes}
                onChange={(e) => setOpeningNotes(e.target.value)}
                placeholder="Any notes?"
                rows={2}
                className="w-full border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-[#e2f5e8] bg-white dark:bg-[#1a2e1f] resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            {showOpenConfirm ? (
              <div className="flex gap-2">
                <button
                  onClick={handleOpenShift}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setShowOpenConfirm(false)}
                  className="px-4 py-2.5 border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-100 dark:hover:bg-[#223927] text-slate-600 dark:text-[#e2f5e8] text-sm font-semibold rounded-xl transition-all"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                disabled={!openingCash}
                onClick={() => setShowOpenConfirm(true)}
                className="w-full py-2.5 bg-blue-600 dark:bg-[#22c55e] hover:bg-blue-700 dark:hover:bg-[#1ea34d] disabled:bg-slate-200 dark:disabled:bg-[#142119] disabled:text-slate-400 dark:disabled:text-slate-600 text-white dark:text-[#0d1a10] text-sm font-bold rounded-xl transition-all"
              >
                Open Shift
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If a shift is open
  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-100 dark:border-[#2d4a35] shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0 flex items-center gap-2">
        <Clock className="w-4 h-4 text-emerald-500 dark:text-[#22c55e]" />
        <h2 className="text-sm font-bold text-emerald-700 dark:text-[#22c55e] uppercase tracking-wider">Current Open Shift</h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Shift Date</p>
            <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{currentShift.date}</p>
          </div>
          <div className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Opened By</p>
            <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{currentShift.openedBy}</p>
          </div>
          <div className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Opened At</p>
            <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{formatTimestamp(currentShift.openedAt)}</p>
          </div>
          <div className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Opening Cash</p>
            <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">Rs. {currentShift.openingCash.toLocaleString()}</p>
          </div>
        </div>

        {/* Expected Cash */}
        <div className="bg-emerald-50 dark:bg-[#142119] border border-emerald-200 dark:border-[#2d4a35] rounded-xl p-4 flex justify-between items-center">
          <p className="text-[11px] font-bold text-emerald-700 dark:text-[#86efac] uppercase tracking-wider">Expected Cash</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-[#22c55e]">Rs. {currentShift.expectedCash.toLocaleString()}</p>
        </div>

        {/* Warning if previous shift is open */}
        {isPreviousShiftOpen && (
          <div className="flex gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-800 dark:text-amber-300 font-bold">Previous shift is still open</p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                This shift is from {currentShift.date}. Count the cash drawer, enter the counted cash below, close this shift, then open today's shift.
              </p>
            </div>
          </div>
        )}

        {/* Cash Count Audit */}
        <div className="border border-slate-200 dark:border-[#2d4a35] rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-4 h-4 text-slate-500 dark:text-[#86efac]" />
            <h3 className="text-xs font-bold text-slate-700 dark:text-[#e2f5e8] uppercase tracking-wider">Cash Count Audit</h3>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Counted Cash</label>
              <input
                type="number"
                min={0}
                value={countedCash}
                onChange={(e) => setCountedCash(e.target.value)}
                placeholder="Enter counted amount..."
                className="w-full border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-[#e2f5e8] bg-slate-50 dark:bg-[#142119] focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div className="flex-1">
               <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Difference</label>
               <div className="w-full border border-slate-100 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 bg-slate-50 dark:bg-[#142119] flex items-center justify-between">
                 <span className={`text-sm font-bold ${countedCash ? diffColor : 'text-slate-400'}`}>
                   {countedCash ? `Rs. ${difference.toLocaleString()}` : '—'}
                 </span>
                 {countedCash && (
                   <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${diffBadgeClass}`}>
                     {diffBadge}
                   </span>
                 )}
               </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">Closing Notes (Optional)</label>
            <textarea
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="Any discrepancies?"
              rows={2}
              className="w-full border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2 text-sm text-slate-700 dark:text-[#e2f5e8] bg-slate-50 dark:bg-[#142119] resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {showCloseConfirm ? (
            <div className="flex gap-2">
              <button
                onClick={handleCloseShift}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all"
              >
                Confirm Close
              </button>
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="px-4 py-2.5 border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-100 dark:hover:bg-[#223927] text-slate-600 dark:text-[#e2f5e8] text-sm font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              disabled={!countedCash}
              onClick={() => setShowCloseConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 dark:bg-[#22c55e] hover:bg-slate-900 dark:hover:bg-[#1ea34d] disabled:bg-slate-200 dark:disabled:bg-[#142119] disabled:text-slate-400 dark:disabled:text-slate-600 text-white dark:text-[#0d1a10] text-sm font-bold rounded-xl transition-all"
            >
              <LogOut className="w-4 h-4" />
              Close Shift
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
