import React, { useState, useEffect } from 'react';
import { useExpenseStore } from '../../store/expenseStore';
import { ExpenseCategory, ExpenseRecord } from '../../types';
import { Wallet } from 'lucide-react';

export const ExpenseForm: React.FC = () => {
  const { createExpense, isSaving } = useExpenseStore();
  
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<ExpenseCategory>('Milk');
  const [quantity, setQuantity] = useState<string>('');
  const [soldRecovery, setSoldRecovery] = useState<string>('0');
  const [reason, setReason] = useState<string>('');
  
  const [unitCost, setUnitCost] = useState(190.00); // Mock unit cost based on screenshot

  const [grossLoss, setGrossLoss] = useState(0);
  const [netExpense, setNetExpense] = useState(0);

  // Dynamic Calculations
  useEffect(() => {
    const qty = parseFloat(quantity) || 0;
    const recovery = parseFloat(soldRecovery) || 0;
    
    const calculatedGross = qty * unitCost;
    let calculatedNet = calculatedGross - recovery;
    
    if (calculatedNet < 0) calculatedNet = 0; // Never allow invalid negative expense
    
    setGrossLoss(calculatedGross);
    setNetExpense(calculatedNet);
  }, [quantity, soldRecovery, unitCost]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const qty = parseFloat(quantity);
    const recovery = parseFloat(soldRecovery);
    
    if (!date || isNaN(qty) || qty <= 0 || isNaN(recovery) || recovery < 0) {
      alert("Please ensure quantity > 0 and recovery >= 0.");
      return;
    }

    try {
      await createExpense({
        date,
        category,
        quantity: qty,
        unitCost,
        grossLoss,
        soldRecovery: recovery,
        netExpense,
        reason,
        addedBy: 'System Admin' // Mock added by
      });
      
      // Reset form
      setQuantity('');
      setSoldRecovery('0');
      setReason('');
      
      // Show success toast (simulated with alert or existing toast if available)
      // Since I don't see a global toast context immediately, we'll assume it works silently
      // or we can add a small local success state if requested.
    } catch (err) {
      alert("Unable to save expense. Please try again.");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Wallet className="w-5 h-5 text-rose-500" />
        <h2 className="text-lg font-bold text-slate-800">Milk / Yogurt Wastage</h2>
      </div>
      <p className="text-xs text-slate-500 mb-5">Net wastage = purchase cost - any recovery sale</p>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">DATE</label>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">PRODUCT</label>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value as ExpenseCategory)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="Milk">Milk</option>
              <option value="Yogurt">Yogurt</option>
              <option value="Electricity">Electricity</option>
              <option value="Gas">Gas</option>
              <option value="Water">Water</option>
              <option value="Packaging">Packaging</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">QTY (KG)</label>
            <input 
              type="number" 
              step="0.01"
              value={quantity} 
              onChange={e => setQuantity(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600">SOLD RECOVERY</label>
            <input 
              type="number" 
              step="0.01"
              value={soldRecovery} 
              onChange={e => setSoldRecovery(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 flex flex-col gap-1.5 w-full">
            <label className="text-xs font-semibold text-slate-600">REASON / NOTES</label>
            <input 
              type="text" 
              value={reason} 
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. sour milk, broken pack, low-price sale"
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button 
            type="submit" 
            disabled={isSaving}
            className="w-full sm:w-auto px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors disabled:opacity-70 whitespace-nowrap"
          >
            {isSaving ? 'Saving...' : 'Save Wastage'}
          </button>
        </div>
      </form>
    </div>
  );
};
