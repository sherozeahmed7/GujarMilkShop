import React, { useEffect, useState } from 'react';
import { X, Info } from 'lucide-react';
import { Product } from '../../types/inventory';
import { inventoryService } from '../../services/inventoryService';

interface AddProductModalProps {
  onClose: () => void;
  onSave: (product: Omit<Product, 'id' | 'status'>) => void | Promise<void>;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    unit: 'kg',
    sellPrice: '',
    cost: '',
    tax: 'Exempt'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  // When true the price fields were auto-filled from live data and are informational
  const [priceLocked, setPriceLocked] = useState(false);
  const [pricingNote, setPricingNote] = useState('');

  useEffect(() => {
    const name = formData.name.trim();
    if (!name) {
      setPriceLocked(false);
      setPricingNote('');
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const pricing = await inventoryService.getPricing(name);
        const hasDynamicSell  = (pricing.sellingPrice || 0) > 0;
        const hasDynamicCost  = (pricing.averageCost  || 0) > 0;

        setFormData((current) => ({
          ...current,
          sellPrice: hasDynamicSell ? String(pricing.sellingPrice) : current.sellPrice,
          cost:      hasDynamicCost  ? String(pricing.averageCost)  : current.cost,
        }));

        // Lock the field only when we have a live DailyRate-backed price
        setPriceLocked(hasDynamicSell);

        if (hasDynamicSell) {
          setPricingNote('Sell price is auto-set from Daily Rates. Cost price is auto-set from supplier data.');
        } else {
          setPricingNote('No rate found in Daily Rates for this product name. Please enter prices manually.');
        }

        setErrors((current) => ({
          ...current,
          cost:      hasDynamicCost  ? '' : '',
          sellPrice: hasDynamicSell  ? '' : '',
        }));
      } catch {
        setPriceLocked(false);
        setPricingNote('Could not load pricing. Please enter prices manually.');
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [formData.name]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.code) newErrors.code = 'Code is required';
    if (!formData.unit) newErrors.unit = 'Unit is required';

    const sell = Number(formData.sellPrice);
    const cost = Number(formData.cost);

    if (isNaN(sell) || sell <= 0) {
      newErrors.sellPrice = 'Selling price must be greater than 0';
    }
    if (isNaN(cost) || cost <= 0) {
      newErrors.cost = 'Cost price must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      setIsSaving(true);
      setErrors({});
      try {
        await onSave({
          name: formData.name,
          code: formData.code,
          description: formData.description,
          category: 'Uncategorized',
          unit: formData.unit,
          sellPrice: Number(formData.sellPrice),
          cost: Number(formData.cost),
          tax: formData.tax,
          stock: 0,
          lowStockThreshold: 10,
          tags: [],
          isLocked: false
        });
        onClose();
      } catch (error: any) {
        setErrors({ form: error?.message || 'Unable to create product.' });
      } finally {
        setIsSaving(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Add New Product</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            {errors.form && <div className="rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-3 py-2 text-sm font-medium text-rose-700">{errors.form}</div>}

            {pricingNote && (
              <div className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-700 dark:text-blue-400">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{pricingNote}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">Product Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className={`w-full border bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] ${errors.code ? 'border-rose-500' : 'border-slate-200 dark:border-[#2d4a35]'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase`}
                  placeholder="e.g. MILK"
                />
                {errors.code && <p className="text-xs text-rose-500 mt-1">{errors.code}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">Product Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full border bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] ${errors.name ? 'border-rose-500' : 'border-slate-200 dark:border-[#2d4a35]'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="e.g. Fresh Milk"
                />
                {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Brief description..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">Unit *</label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="w-full border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="kg">kg</option>
                  <option value="ltr">ltr</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">Tax</label>
                <select
                  value={formData.tax}
                  onChange={(e) => setFormData({...formData, tax: e.target.value})}
                  className="w-full border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Exempt">Exempt</option>
                  <option value="Standard">Standard (17%)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">
                  Cost Price *
                  {priceLocked && <span className="ml-1 text-xs text-blue-500">(from supplier data)</span>}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => setFormData({...formData, cost: e.target.value})}
                  className={`w-full border ${errors.cost ? 'border-rose-500' : 'border-slate-200 dark:border-[#2d4a35]'} rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="0.00"
                />
                {errors.cost && <p className="text-xs text-rose-500 mt-1">{errors.cost}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">
                  Sell Price *
                  {priceLocked && <span className="ml-1 text-xs text-blue-500">(from Daily Rates)</span>}
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.sellPrice}
                  onChange={(e) => !priceLocked && setFormData({...formData, sellPrice: e.target.value})}
                  readOnly={priceLocked}
                  className={`w-full border ${errors.sellPrice ? 'border-rose-500' : 'border-slate-200 dark:border-[#2d4a35]'} rounded-lg px-3 py-2 text-sm ${priceLocked ? 'bg-slate-100 dark:bg-[#142119] cursor-not-allowed' : 'bg-white dark:bg-[#142119]'} text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="0.00"
                />
                {errors.sellPrice && <p className="text-xs text-rose-500 mt-1">{errors.sellPrice}</p>}
                {priceLocked && (
                  <p className="text-xs text-slate-400 dark:text-[#64916e] mt-1">
                    Update this in <strong>Daily Rates</strong> to change it.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124] rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-60">
              {isSaving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};