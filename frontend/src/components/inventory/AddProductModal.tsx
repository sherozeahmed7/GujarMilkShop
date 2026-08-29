import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
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

  useEffect(() => {
    const name = formData.name.trim();
    if (!name) {
      setFormData((current) => ({ ...current, cost: '', sellPrice: '' }));
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const pricing = await inventoryService.getPricing(name);
        setFormData((current) => ({ ...current, cost: pricing.averageCost ? String(pricing.averageCost) : '', sellPrice: pricing.sellingPrice ? String(pricing.sellingPrice) : '' }));
        setErrors((current) => ({
          ...current,
          cost: pricing.averageCost ? '' : 'No supplier cost — enter manually to proceed',
          sellPrice: pricing.sellingPrice ? '' : 'Selling price is not configured in Daily Rates',
        }));
      } catch {
        setFormData((current) => ({ ...current, cost: current.cost || '', sellPrice: '' }));
        setErrors((current) => ({
          ...current,
          cost: 'Enter cost manually to proceed',
          sellPrice: 'Selling price is not configured in Daily Rates',
        }));
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [formData.name]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.code) newErrors.code = 'Code is required';
    if (!formData.unit) newErrors.unit = 'Unit is required';
    
    if (isNaN(Number(formData.sellPrice)) || Number(formData.sellPrice) <= 0) {
      newErrors.sellPrice = 'Selling price is not configured in Daily Rates';
    }
    if (isNaN(Number(formData.cost)) || Number(formData.cost) <= 0) {
      newErrors.cost = 'Enter cost manually if no supplier cost is available';
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Add New Product</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            {errors.form && <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{errors.form}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Code *</label>
                <input 
                  type="text" 
                  value={formData.code}
                  onChange={(e) => setFormData({...formData, code: e.target.value})}
                  className={`w-full border ${errors.code ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase`} 
                  placeholder="e.g. MILK" 
                />
                {errors.code && <p className="text-xs text-rose-500 mt-1">{errors.code}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name *</label>
                <input 
                  type="text" 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={`w-full border ${errors.name ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`} 
                  placeholder="e.g. Fresh Milk" 
                />
                {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                rows={2}
                placeholder="Brief description..."
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit *</label>
                <select 
                  value={formData.unit}
                  onChange={(e) => setFormData({...formData, unit: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="kg">kg</option>
                  <option value="ltr">ltr</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax</label>
                <select 
                  value={formData.tax}
                  onChange={(e) => setFormData({...formData, tax: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Exempt">Exempt</option>
                  <option value="Standard">Standard (17%)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Cost Price *</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.cost}
                  onChange={(e) => {
                    setFormData({ ...formData, cost: e.target.value });
                    setErrors((current) => ({ ...current, cost: '' }));
                  }}
                  className={`w-full border ${errors.cost ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                  placeholder="Enter cost if no supplier price" 
                />
                <p className="text-[10px] text-slate-400 mt-1">Auto-filled from supplier when available. For yogurt, enter manually.</p>
                {errors.cost && <p className="text-xs text-rose-500 mt-1">{errors.cost}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sell Price *</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.sellPrice}
                  readOnly
                  className={`w-full border ${errors.sellPrice ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm bg-slate-100 focus:outline-none`}
                  placeholder="0.00" 
                />
                {errors.sellPrice && <p className="text-xs text-rose-500 mt-1">{errors.sellPrice}</p>}
              </div>
            </div>


          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
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
