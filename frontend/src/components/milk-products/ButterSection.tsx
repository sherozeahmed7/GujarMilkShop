import React, { useEffect, useState } from 'react';
import { MilkProductsDailyStock } from '../../types/milkProducts.types';
import { Plus, SlidersHorizontal } from 'lucide-react';

interface Props {
  stock: MilkProductsDailyStock;
  onAddProduction: (qty: number) => void;
  onOpenConversion: () => void;
  onAddToCart?: (name: string, qty: number, unitPrice: number, total?: number) => void;
  defaultRatePerKg?: number;
}

export const ButterSection: React.FC<Props> = ({
  stock,
  onAddProduction,
  onOpenConversion,
  onAddToCart,
  defaultRatePerKg = 0,
}) => {
  const [prodInput, setProdInput] = useState('');
  const [saleQty, setSaleQty] = useState('');
  const [salePrice, setSalePrice] = useState(
    defaultRatePerKg > 0 ? String(defaultRatePerKg) : ''
  );
  const [saleError, setSaleError] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    if (defaultRatePerKg > 0) {
      setSalePrice(String(defaultRatePerKg));
    }
  }, [defaultRatePerKg]);

  const effectiveRate =
    parseFloat(salePrice) > 0
      ? parseFloat(salePrice)
      : defaultRatePerKg > 0
        ? defaultRatePerKg
        : 1200;

  const handleProd = () => {
    const q = parseFloat(prodInput);
    if (q > 0) onAddProduction(q);
    setProdInput('');
  };

  const handleWeightPreset = (weight: number) => {
    const rate = effectiveRate;
    if (!rate || rate <= 0) {
      setSaleError('Enter a valid rate per kg first.');
      return;
    }
    setSaleError('');
    const total = Math.round(weight * rate * 100) / 100;
    onAddToCart?.('Butter', weight, rate, total);
  };

  const handleAmountPreset = (amt: number) => {
    const rate = effectiveRate;
    if (!rate || rate <= 0) {
      setSaleError('Enter a valid rate per kg first.');
      return;
    }
    setSaleError('');
    const qty = parseFloat((amt / rate).toFixed(3));
    onAddToCart?.('Butter', qty, rate, amt);
  };

  const handleAddToCart = () => {
    const qty = parseFloat(saleQty);
    const price = parseFloat(salePrice) || effectiveRate;
    if (!qty || qty <= 0 || !price || price <= 0) {
      setSaleError('Enter a valid quantity and price > 0.');
      return;
    }
    setSaleError('');
    onAddToCart?.('Butter', qty, price, Math.round(qty * price * 100) / 100);
    setSaleQty('');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800">
              Butter
            </h3>
            <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
              Persistent
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Rs. {effectiveRate.toLocaleString()} / kg &nbsp;|&nbsp; Stock:{' '}
            <span className="font-bold text-amber-600">{stock.butterClosing} kg</span>
          </p>
        </div>

        {onAddToCart && (
          <button
            type="button"
            onClick={() => setShowCustom((prev) => !prev)}
            className={`text-xs px-2.5 py-1 rounded-lg font-semibold border flex items-center gap-1.5 transition-colors ${
              showCustom
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            Custom
          </button>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Quick Presets Section */}
        {onAddToCart && (
          <div className="space-y-2.5 pb-3 border-b border-slate-100">
            {/* 2x2 Weight Presets */}
            <div className="grid grid-cols-2 gap-2">
              {[0.25, 0.5, 1, 2].map((w) => {
                const price = Math.round(w * effectiveRate);
                return (
                  <button
                    key={`butter-w-${w}`}
                    type="button"
                    onClick={() => handleWeightPreset(w)}
                    className="border border-amber-200/80 bg-amber-50/40 hover:bg-amber-100/70 hover:border-amber-400 rounded-xl p-2.5 flex flex-col items-center justify-center transition-all shadow-sm active:scale-95 group"
                  >
                    <span className="font-bold text-slate-800 text-sm group-hover:text-amber-800">
                      {w} kg
                    </span>
                    <span className="text-xs text-amber-700 font-semibold mt-0.5">
                      Rs. {price.toLocaleString()}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Rupee Amount Presets */}
            <div className="grid grid-cols-4 gap-1.5">
              {[100, 250, 500, 1000].map((amt) => (
                <button
                  key={`butter-amt-${amt}`}
                  type="button"
                  onClick={() => handleAmountPreset(amt)}
                  className="border border-slate-200 bg-white hover:bg-amber-500 hover:text-white hover:border-amber-500 rounded-lg py-1.5 px-1 text-center font-bold text-xs text-slate-700 transition-all shadow-xs active:scale-95"
                >
                  {amt >= 1000 ? amt.toLocaleString() : amt}
                </button>
              ))}
            </div>

            {/* Custom Sell Inputs (collapsible) */}
            {showCustom && (
              <div className="space-y-2 pt-2 border-t border-dashed border-amber-200">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  Custom Quantity & Rate
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Qty (kg)"
                    className={`flex-1 border rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                      saleError ? 'border-red-400' : 'border-slate-200'
                    }`}
                    value={saleQty}
                    onChange={(e) => {
                      setSaleQty(e.target.value);
                      setSaleError('');
                    }}
                  />
                  <input
                    type="number"
                    placeholder="Rs/kg"
                    className={`w-20 border rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                      saleError ? 'border-red-400' : 'border-slate-200'
                    }`}
                    value={salePrice}
                    onChange={(e) => {
                      setSalePrice(e.target.value);
                      setSaleError('');
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    + Cart
                  </button>
                </div>
                {saleError && <p className="text-xs text-red-500">{saleError}</p>}
              </div>
            )}
          </div>
        )}

        {/* Stock Details */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Opening:</span>
            <span className="font-medium text-slate-800">{stock.butterOpening} kg</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Added:</span>
            <span className="font-medium text-slate-800">{stock.butterProduced} kg</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Sold:</span>
            <span className="font-medium text-slate-800">{stock.butterSold} kg</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Converted to Ghee:</span>
            <span className="font-medium text-slate-800">{stock.butterConverted} kg</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-slate-100">
            <span className="font-bold text-slate-700">Closing Stock:</span>
            <span className="font-bold text-amber-600">{stock.butterClosing} kg</span>
          </div>
        </div>

        {/* Production & Actions */}
        <div className="mt-auto space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Production (kg)"
              className="flex-1 border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
              value={prodInput}
              onChange={(e) => setProdInput(e.target.value)}
            />
            <button
              onClick={handleProd}
              className="bg-amber-50 hover:bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200 text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onOpenConversion}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-2 text-xs font-bold transition-colors"
          >
            Convert Butter to Ghee
          </button>
        </div>
      </div>
    </div>
  );
};
