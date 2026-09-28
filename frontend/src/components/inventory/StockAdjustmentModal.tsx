import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Product } from '../../types/inventory';

interface StockAdjustmentModalProps {
  product: Product;
  onClose: () => void;
  onSave: (productId: string, type: 'Add Stock' | 'Remove Stock' | 'Set Stock', quantity: number, reason: string, user: string) => void;
}

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({ product, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    type: 'Add Stock' as 'Add Stock' | 'Remove Stock' | 'Set Stock',
    quantity: '',
    reason: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.reason) newErrors.reason = 'Reason is required';
    
    if (isNaN(Number(formData.quantity)) || Number(formData.quantity) < 0) {
      newErrors.quantity = 'Valid positive quantity required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave(
        product.id,
        formData.type,
        Number(formData.quantity),
        formData.reason,
        'System Admin'
      );
      onClose();
    }
  };

  const getNewStockPreview = () => {
    const qty = Number(formData.quantity) || 0;
    if (formData.type === 'Add Stock') return product.stock + qty;
    if (formData.type === 'Remove Stock') return Math.max(0, product.stock - qty);
    if (formData.type === 'Set Stock') return qty;
    return product.stock;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Adjust Stock</h2>
          <button onClick={onClose} className="text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae]">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            
            <div className="bg-slate-50 dark:bg-[#142119] p-3 rounded-lg border border-slate-200 dark:border-[#2d4a35] mb-2">
              <div className="text-xs text-slate-500 dark:text-[#8ba895] font-medium">Product</div>
              <div className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{product.name} ({product.code})</div>
              <div className="text-xs text-slate-500 dark:text-[#8ba895] font-medium mt-2">Current Stock</div>
              <div className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{product.stock} {product.unit}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">Adjustment Type *</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value as any})}
                className="w-full border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Add Stock">Add Stock (+)</option>
                <option value="Remove Stock">Remove Stock (-)</option>
                <option value="Set Stock">Set Exact Stock (=)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">Quantity *</label>
              <div className="relative">
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.quantity}
                  onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                  className={`w-full border bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] ${errors.quantity ? 'border-rose-500' : 'border-slate-200 dark:border-[#2d4a35]'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`} 
                  placeholder="0" 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 dark:text-[#64916e]">
                  {product.unit}
                </span>
              </div>
              {errors.quantity && <p className="text-xs text-rose-500 mt-1">{errors.quantity}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-[#a7c4ae] mb-1">Reason / Notes *</label>
              <input 
                type="text" 
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value})}
                className={`w-full border bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] ${errors.reason ? 'border-rose-500' : 'border-slate-200 dark:border-[#2d4a35]'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`} 
                placeholder="e.g. Damage, Expiry, Found in warehouse" 
              />
              {errors.reason && <p className="text-xs text-rose-500 mt-1">{errors.reason}</p>}
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg border border-amber-100 dark:border-amber-900/40 mt-4 flex justify-between items-center">
              <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">New Stock Preview:</span>
              <span className="text-lg font-bold text-amber-900 dark:text-amber-200">
                {getNewStockPreview()} {product.unit}
              </span>
            </div>
            
          </div>

          <div className="px-6 py-4 border-t border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124] rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
              Confirm Adjustment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
