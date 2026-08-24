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
      // Calculate difference from currently recorded sold to avoid double counting
      const diff = sold - currentSold;
      if (diff !== 0) {
        await milkProductsService.addLassiSale(date, diff);
      }
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-800">
          <h2 className="text-lg font-bold text-white">End-of-Day Lassi Reconciliation</h2>
          <p className="text-xs text-slate-400 mt-1">Finalize Lassi sales for the day</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 bg-rose-50 text-rose-600 text-sm p-3 rounded-lg border border-rose-100">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date</label>
              <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700">
                {date}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Total Lassi Sold Today (kg) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={lassiSold}
                onChange={e => setLassiSold(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-xs text-slate-500 mt-1">Currently recorded sales: {currentSold} kg</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
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
