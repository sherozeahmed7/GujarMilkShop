import React, { useState } from 'react';
import { X, Calculator } from 'lucide-react';
import { useRegisterStore } from '../../store/registerStore';

interface CountCashModalProps {
  onClose: () => void;
  onSaved?: () => void;
}

export const CountCashModal: React.FC<CountCashModalProps> = ({ onClose, onSaved }) => {
  const { currentRegister: data, setCountedCash } = useRegisterStore();

  const expectedCash = data?.expectedCash ?? 0;

  const [countedValue, setCountedValue] = useState<string>(
    data?.countedCash !== undefined ? data.countedCash.toString() : ''
  );
  const [notes, setNotes] = useState<string>(data?.notes || '');

  const parsedCounted = parseFloat(countedValue);
  const difference = !isNaN(parsedCounted) ? parsedCounted - expectedCash : null;

  let diffBadge = '';
  let diffBadgeClass = '';

  if (difference !== null) {
    if (difference === 0) {
      diffBadge = 'Balanced';
      diffBadgeClass = 'bg-emerald-100 text-emerald-700';
    } else if (difference < 0) {
      diffBadge = 'Short';
      diffBadgeClass = 'bg-rose-100 text-rose-700';
    } else {
      diffBadge = 'Over';
      diffBadgeClass = 'bg-amber-100 text-amber-700';
    }
  }

  const handleSave = () => {
    if (!isNaN(parsedCounted) && parsedCounted >= 0) {
      setCountedCash(parsedCounted, notes);
      onClose();
      if (onSaved) onSaved();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calculator className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Count Drawer Cash</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expected Cash</span>
            <span className="text-sm font-bold text-slate-800">Rs. {expectedCash.toLocaleString()}</span>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Counted Cash</label>
            <input
              type="number"
              min={0}
              value={countedValue}
              onChange={(e) => setCountedValue(e.target.value)}
              placeholder="Enter real cash counted..."
              className="w-full border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-[#e2f5e8] bg-white dark:bg-[#142119] focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {difference !== null && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex justify-between items-center">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Difference</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${difference < 0 ? 'text-rose-600' : difference > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                  Rs. {difference.toLocaleString()}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${diffBadgeClass}`}>
                  {diffBadge}
                </span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain any difference..."
              rows={2}
              className="w-full border border-slate-200 dark:border-[#2d4a35] rounded-xl px-4 py-2 text-sm text-slate-700 dark:text-[#e2f5e8] bg-white dark:bg-[#142119] resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={handleSave}
            disabled={isNaN(parsedCounted) || parsedCounted < 0}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
          >
            Save Count
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold rounded-xl transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
