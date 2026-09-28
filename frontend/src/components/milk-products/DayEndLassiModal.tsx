import React, { useState } from 'react';
import { milkProductsService } from '../../services/milkProducts.service';

interface Props {
  date: string;
  currentSold: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const DayEndLassiModal: React.FC<Props> = ({ date, currentSold, onClose, onSuccess }) => {
  const [lassiSold, setLassiSold] = useState(currentSold.toString());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const sold = parseFloat(lassiSold);
    if (isNaN(sold) || sold < 0) return setError('Enter a valid non-negative quantity');

    setSubmitting(true);
    try {
      await milkProductsService.setDayEndLassi(date, sold);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] bg-slate-800">
          <h2 className="text-lg font-bold text-white">End-of-Day Lassi Reconciliation</h2>
          <p className="text-xs text-slate-400 mt-1">Finalize Lassi sales for the day</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-sm p-3 rounded-lg border border-rose-100 dark:border-rose-900/40">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Date</label>
              <div className="px-3 py-2 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-lg text-sm font-medium text-slate-700 dark:text-[#a7c4ae]">
                {date}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Total Lassi Sold Today (kg) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={lassiSold}
                onChange={e => setLassiSold(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#142119] border border-slate-300 dark:border-[#2d4a35] rounded-lg text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-xs text-slate-500 dark:text-[#8ba895] mt-1">Currently recorded sales: {currentSold} kg</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold bg-white dark:bg-[#142119] text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124] border border-slate-200 dark:border-[#2d4a35] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2 text-sm font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors disabled:opacity-50"
            >
              Save Day-End Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
