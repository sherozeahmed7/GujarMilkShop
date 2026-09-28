import React, { useState } from 'react';
import { milkProductsService } from '../../services/milkProducts.service';

interface Props {
  date: string;
  availableButter: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ButterGheeConversionModal: React.FC<Props> = ({ date, availableButter, onClose, onSuccess }) => {
  const [butterUsed, setButterUsed] = useState('');
  const [gheeProduced, setGheeProduced] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const bUsed = parseFloat(butterUsed);
    const gProd = parseFloat(gheeProduced);

    if (isNaN(bUsed) || bUsed <= 0) return setError('Enter valid Butter used');
    if (isNaN(gProd) || gProd <= 0) return setError('Enter valid Ghee produced');
    if (bUsed > availableButter) return setError(`Cannot use more than available Butter (${availableButter} kg)`);

    setSubmitting(true);
    try {
      await milkProductsService.convertButterToGhee(date, bUsed, gProd, notes);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Conversion failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] bg-amber-50 dark:bg-amber-950/40">
          <h2 className="text-lg font-bold text-amber-900 dark:text-amber-300">Convert Butter to Ghee</h2>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80 mt-1">Record the conversion of butter into desi ghee</p>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Butter Used (kg) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={butterUsed}
                  onChange={e => setButterUsed(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#142119] border border-slate-300 dark:border-[#2d4a35] rounded-lg text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder={`Max: ${availableButter}`}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Ghee Produced (kg) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={gheeProduced}
                  onChange={e => setGheeProduced(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#142119] border border-slate-300 dark:border-[#2d4a35] rounded-lg text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-[#142119] p-3 rounded-lg border border-slate-200 dark:border-[#2d4a35] flex justify-between text-sm">
              <span className="text-slate-600 dark:text-[#a7c4ae] font-medium">Butter Available:</span>
              <span className="font-bold text-slate-800 dark:text-[#e2f5e8]">{availableButter} kg</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Notes (Optional)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-[#142119] border border-slate-300 dark:border-[#2d4a35] rounded-lg text-sm text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-slate-500"
                placeholder="e.g. Morning batch"
              />
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
              className="px-6 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
            >
              Confirm Conversion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
