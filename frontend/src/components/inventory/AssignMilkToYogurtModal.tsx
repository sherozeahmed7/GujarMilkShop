import React, { useState } from 'react';
import { X } from 'lucide-react';
import { inventoryService } from '../../services/inventoryService';

interface AssignMilkToYogurtModalProps {
  onClose: () => void;
  onDone: () => void;
}

export const AssignMilkToYogurtModal: React.FC<AssignMilkToYogurtModalProps> = ({ onClose, onDone }) => {
  const [milkQty, setMilkQty] = useState('');
  const [yogurtQty, setYogurtQty] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const milk = parseFloat(milkQty);
    const yogurt = parseFloat(yogurtQty || milkQty);
    if (!Number.isFinite(milk) || milk <= 0) {
      setError('Enter milk quantity greater than 0.');
      return;
    }
    if (!Number.isFinite(yogurt) || yogurt <= 0) {
      setError('Enter yogurt quantity greater than 0.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await inventoryService.assignMilkToYogurt(milk, yogurt);
      onDone();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to assign milk to yogurt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Assign Milk → Yogurt</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-slate-500">
            Milk stock will decrease by the milk qty. Yogurt stock will increase by the yogurt qty.
          </p>
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Milk used (kg) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={milkQty}
              onChange={(e) => {
                setMilkQty(e.target.value);
                if (!yogurtQty) setYogurtQty(e.target.value);
              }}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. 20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Yogurt produced (kg) *</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={yogurtQty}
              onChange={(e) => setYogurtQty(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Same as milk if 1:1"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
