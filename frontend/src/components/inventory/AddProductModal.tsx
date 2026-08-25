import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Product } from '../../types/inventory';

interface AddProductModalProps {
  onClose: () => void;
  onSave: (product: Omit<Product, 'id' | 'status'>) => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    category: 'Dairy',
    unit: 'kg',
    sellPrice: '',
    cost: '',
    tax: 'Exempt',
    stock: '',
    lowStockThreshold: '10'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.code) newErrors.code = 'Code is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.unit) newErrors.unit = 'Unit is required';
    
    if (isNaN(Number(formData.sellPrice)) || Number(formData.sellPrice) < 0) {
      newErrors.sellPrice = 'Valid positive number required';
    }
    if (isNaN(Number(formData.cost)) || Number(formData.cost) < 0) {
      newErrors.cost = 'Valid positive number required';
    }
    if (formData.stock !== '' && (isNaN(Number(formData.stock)) || Number(formData.stock) < 0)) {
      newErrors.stock = 'Valid zero or positive number required';
    }
    if (isNaN(Number(formData.lowStockThreshold)) || Number(formData.lowStockThreshold) < 0) {
      newErrors.lowStockThreshold = 'Valid positive number required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave({
        name: formData.name,
        code: formData.code,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        sellPrice: Number(formData.sellPrice),
        cost: Number(formData.cost),
        tax: formData.tax,
        stock: Number(formData.stock || 0),
        lowStockThreshold: Number(formData.lowStockThreshold || 10),
        tags: [],
        isLocked: false
      });
      onClose();
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
                <select 
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value})}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Dairy">Dairy</option>
                  <option value="Beverages">Beverages</option>
                  <option value="Other">Other</option>
                </select>
              </div>
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
                  onChange={(e) => setFormData({...formData, cost: e.target.value})}
                  className={`w-full border ${errors.cost ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`} 
                  placeholder="0.00" 
                />
                {errors.cost && <p className="text-xs text-rose-500 mt-1">{errors.cost}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sell Price *</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.sellPrice}
                  onChange={(e) => setFormData({...formData, sellPrice: e.target.value})}
                  className={`w-full border ${errors.sellPrice ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`} 
                  placeholder="0.00" 
                />
                {errors.sellPrice && <p className="text-xs text-rose-500 mt-1">{errors.sellPrice}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Opening Stock</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.stock}
                  onChange={(e) => setFormData({...formData, stock: e.target.value})}
                  className={`w-full border ${errors.stock ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`} 
                  placeholder="0.00" 
                />
                {errors.stock && <p className="text-xs text-rose-500 mt-1">{errors.stock}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Low Stock Threshold</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.lowStockThreshold}
                  onChange={(e) => setFormData({...formData, lowStockThreshold: e.target.value})}
                  className={`w-full border ${errors.lowStockThreshold ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`} 
                  placeholder="10" 
                />
                {errors.lowStockThreshold && <p className="text-xs text-rose-500 mt-1">{errors.lowStockThreshold}</p>}
              </div>
            </div>
            
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
              Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
