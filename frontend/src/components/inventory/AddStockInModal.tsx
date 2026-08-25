import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Product, StockIn } from '../../types/inventory';

interface AddStockInModalProps {
  products: Product[];
  onClose: () => void;
  onSave: (data: Omit<StockIn, 'id' | 'date' | 'totalCost'>) => void;
}

export const AddStockInModal: React.FC<AddStockInModalProps> = ({ products, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    productId: products.length > 0 ? products[0].id : '',
    quantity: '',
    unitCost: '',
    supplier: '',
    reference: '',
    addedBy: 'System Admin'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedProduct = products.find(p => p.id === formData.productId);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.productId) newErrors.productId = 'Product is required';
    if (!formData.supplier) newErrors.supplier = 'Supplier is required';
    
    if (isNaN(Number(formData.quantity)) || Number(formData.quantity) <= 0) {
      newErrors.quantity = 'Valid positive quantity required';
    }
    if (isNaN(Number(formData.unitCost)) || Number(formData.unitCost) < 0) {
      newErrors.unitCost = 'Valid positive cost required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave({
        productId: formData.productId,
        quantity: Number(formData.quantity),
        unitCost: Number(formData.unitCost),
        supplier: formData.supplier,
        reference: formData.reference,
        addedBy: formData.addedBy
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Receive Stock In</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Product *</label>
              <select 
                value={formData.productId}
                onChange={(e) => setFormData({...formData, productId: e.target.value})}
                className={`w-full border ${errors.productId ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
              >
                {products.length === 0 && <option value="">No products available</option>}
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
              {errors.productId && <p className="text-xs text-rose-500 mt-1">{errors.productId}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity *</label>
                <div className="relative">
                  <input 
                    type="number" 
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData({...formData, quantity: e.target.value})}
                    className={`w-full border ${errors.quantity ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`} 
                    placeholder="0" 
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {selectedProduct?.unit || ''}
                  </span>
                </div>
                {errors.quantity && <p className="text-xs text-rose-500 mt-1">{errors.quantity}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Cost *</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={formData.unitCost}
                  onChange={(e) => setFormData({...formData, unitCost: e.target.value})}
                  className={`w-full border ${errors.unitCost ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`} 
                  placeholder="0.00" 
                />
                {errors.unitCost && <p className="text-xs text-rose-500 mt-1">{errors.unitCost}</p>}
              </div>
            </div>
            
            {(Number(formData.quantity) > 0 && Number(formData.unitCost) >= 0) && (
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex justify-between items-center">
                <span className="text-sm text-blue-700 font-medium">Total Cost:</span>
                <span className="text-lg font-bold text-blue-800">
                  Rs. {(Number(formData.quantity) * Number(formData.unitCost)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Supplier *</label>
              <input 
                type="text" 
                value={formData.supplier}
                onChange={(e) => setFormData({...formData, supplier: e.target.value})}
                className={`w-full border ${errors.supplier ? 'border-rose-500' : 'border-slate-200'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`} 
                placeholder="e.g. Local Dairy Farm" 
              />
              {errors.supplier && <p className="text-xs text-rose-500 mt-1">{errors.supplier}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Reference / Invoice No</label>
              <input 
                type="text" 
                value={formData.reference}
                onChange={(e) => setFormData({...formData, reference: e.target.value})}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                placeholder="e.g. INV-2023-001" 
              />
            </div>
            
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={products.length === 0} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50">
              Save Stock In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
