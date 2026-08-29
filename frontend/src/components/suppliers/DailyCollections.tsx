import React, { useState, useEffect } from 'react';
import { Supplier, ShiftType, MilkType } from '../../types';
import { useSupplierStore } from '../../store/supplierStore';
import { Calendar as CalendarIcon, Save, Trash2, Edit2 } from 'lucide-react';

interface DailyCollectionsProps {
  supplier: Supplier;
}

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const DailyCollections: React.FC<DailyCollectionsProps> = ({ supplier }) => {
  const todayStr = localDateKey(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800">Collections for Date</h3>
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          <CalendarIcon className="w-4 h-4 text-slate-500" />
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 p-0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ShiftCard supplier={supplier} date={selectedDate} shift="Morning" />
        <ShiftCard supplier={supplier} date={selectedDate} shift="Evening" />
      </div>
    </div>
  );
};

interface ShiftCardProps {
  supplier: Supplier;
  date: string;
  shift: ShiftType;
}

const ShiftCard: React.FC<ShiftCardProps> = ({ supplier, date, shift }) => {
  const { collections, addCollection, updateCollection, deleteCollection } = useSupplierStore();
  
  // Find if there is already a collection for this shift and date
  const existingCollection = collections.find(c => 
    c.supplierId === supplier.id && c.date === date && c.shift === shift
  );

  const [isEditing, setIsEditing] = useState(!existingCollection);
  
  const [milkType, setMilkType] = useState<MilkType>(existingCollection?.milkType || 'Mixed');
  const [quantity, setQuantity] = useState<string>(existingCollection?.quantity.toString() || '');
  const [rate, setRate] = useState<string>(existingCollection?.rate.toString() || supplier.defaultRate.toString());
  const [notes, setNotes] = useState<string>(existingCollection?.notes || '');

  // Update form if existingCollection changes (e.g. date changed)
  useEffect(() => {
    if (existingCollection) {
      setMilkType(existingCollection.milkType);
      setQuantity(existingCollection.quantity.toString());
      setRate(existingCollection.rate.toString());
      setNotes(existingCollection.notes || '');
      setIsEditing(false);
    } else {
      setQuantity('');
      setRate(supplier.defaultRate.toString());
      setNotes('');
      setIsEditing(true);
    }
  }, [existingCollection, supplier.defaultRate]);

  // Auto update rate based on milk type if in edit mode and empty rate
  useEffect(() => {
    if (isEditing && !existingCollection) {
      if (milkType === 'Cow') setRate(supplier.cowRate.toString());
      else if (milkType === 'Buffalo') setRate(supplier.buffaloRate.toString());
      else setRate(supplier.defaultRate.toString());
    }
  }, [milkType, isEditing, supplier, existingCollection]);

  const numQty = parseFloat(quantity) || 0;
  const numRate = parseFloat(rate) || 0;
  const totalAmount = numQty * numRate;

  const handleSave = () => {
    if (numQty <= 0) return;
    
    if (existingCollection) {
      updateCollection(existingCollection.id, {
        milkType,
        quantity: numQty,
        rate: numRate,
        amount: totalAmount,
        notes
      });
    } else {
      addCollection({
        supplierId: supplier.id,
        date,
        shift,
        milkType,
        quantity: numQty,
        rate: numRate,
        amount: totalAmount,
        notes
      });
    }
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (existingCollection) {
      deleteCollection(existingCollection.id);
    }
  };

  return (
    <div className={`rounded-xl border ${shift === 'Morning' ? 'border-amber-200 bg-amber-50/30' : 'border-indigo-200 bg-indigo-50/30'} p-5 flex flex-col gap-4 shadow-sm`}>
      <div className="flex items-center justify-between">
        <h4 className={`text-sm font-bold uppercase tracking-wider ${shift === 'Morning' ? 'text-amber-700' : 'text-indigo-700'}`}>
          {shift} Shift
        </h4>
        <select 
          value={milkType} 
          onChange={(e) => setMilkType(e.target.value as MilkType)}
          disabled={!isEditing}
          className="text-xs font-bold bg-white border border-slate-200 text-slate-600 rounded-md px-2 py-1 uppercase tracking-wider disabled:opacity-70 disabled:bg-slate-50"
        >
          <option value="Mixed">Mixed</option>
          <option value="Cow">Cow</option>
          <option value="Buffalo">Buffalo</option>
        </select>
      </div>

      <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100 flex flex-col gap-4">
        <h5 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{milkType} MILK</h5>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Quantity (KG)</label>
            <input 
              type="number" 
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={!isEditing}
              placeholder="0.00"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Farmer Rate / KG</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-sm">Rs.</span>
              <input 
                type="number" 
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                disabled={!isEditing}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-lg font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
              />
            </div>
          </div>
        </div>

        <input 
          type="text" 
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={!isEditing}
          placeholder="Notes (optional)"
          className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 disabled:opacity-70"
        />

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</span>
            <span className="text-xl font-bold text-blue-700">Rs. {totalAmount.toLocaleString()}</span>
            {supplier.guaranteedAdvance > 0 && (
              <span className="text-[10px] text-emerald-600 font-medium mt-0.5">
                Advance −Rs. {supplier.guaranteedAdvance.toLocaleString()} cuts payable after save
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            {existingCollection && !isEditing && (
              <>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={handleDelete}
                  className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            
            {isEditing && (
              <>
                {existingCollection && (
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                )}
                <button 
                  onClick={handleSave}
                  disabled={numQty <= 0 || numRate <= 0}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
