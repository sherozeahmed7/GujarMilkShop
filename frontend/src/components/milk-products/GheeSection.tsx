import React, { useState } from 'react';
import { MilkProductsDailyStock } from '../../types/milkProducts.types';
import { Plus } from 'lucide-react';

interface Props {
  stock: MilkProductsDailyStock;
  onAddProduction: (qty: number) => void;
  onAddToCart?: (name: string, qty: number, unitPrice: number) => void;
}

export const GheeSection: React.FC<Props> = ({ stock, onAddProduction, onAddToCart }) => {
  const [prodInput, setProdInput] = useState('');
  const [saleQty, setSaleQty] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [saleError, setSaleError] = useState('');

  const handleProd = () => {
    const q = parseFloat(prodInput);
    if (q > 0) onAddProduction(q);
    setProdInput('');
  };

  const handleAddToCart = () => {
    const qty = parseFloat(saleQty);
    const price = parseFloat(salePrice);
    if (!qty || qty <= 0 || !price || price <= 0) {
      setSaleError('Enter a valid quantity and price > 0.');
      return;
    }
    setSaleError('');
    onAddToCart?.('Ghee', qty, price);
    setSaleQty('');
    setSalePrice('');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            Desi Ghee
            <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Persistent</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Stock carries forward to the next day</p>
        </div>
      </div>
      
      <div className="p-4 flex-1 flex flex-col gap-3">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Opening:</span>
          <span className="font-medium text-slate-800">{stock.gheeOpening} kg</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Produced/Added:</span>
          <span className="font-medium text-slate-800">{stock.gheeProduced} kg</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Sold:</span>
          <span className="font-medium text-slate-800">{stock.gheeSold} kg</span>
        </div>
        <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
          <span className="font-bold text-slate-700">Closing Stock:</span>
          <span className="font-bold text-orange-600">{stock.gheeClosing} kg</span>
        </div>

        <div className="mt-auto space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <input 
              type="number" 
              placeholder="Production (kg)"
              className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
              value={prodInput}
              onChange={e => setProdInput(e.target.value)}
            />
            <button onClick={handleProd} className="bg-orange-50 hover:bg-orange-100 text-orange-700 px-3 py-1.5 rounded-lg border border-orange-200 text-sm font-medium transition-colors"><Plus className="w-4 h-4"/></button>
          </div>

          {onAddToCart && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sell → Add to Cart</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Qty (kg)"
                  className={`flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 ${saleError ? 'border-red-400' : 'border-slate-200'}`}
                  value={saleQty}
                  onChange={e => { setSaleQty(e.target.value); setSaleError(''); }}
                />
                <input
                  type="number"
                  placeholder="Rs/kg"
                  className={`w-24 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500 ${saleError ? 'border-red-400' : 'border-slate-200'}`}
                  value={salePrice}
                  onChange={e => { setSalePrice(e.target.value); setSaleError(''); }}
                />
                <button
                  onClick={handleAddToCart}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg text-sm font-bold transition-colors whitespace-nowrap"
                >
                  + Cart
                </button>
              </div>
              {saleError && <p className="text-xs text-red-500">{saleError}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
