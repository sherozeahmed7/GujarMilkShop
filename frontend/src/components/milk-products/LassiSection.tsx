import React, { useEffect, useState } from 'react';
import { MilkProductsDailyStock } from '../../types/milkProducts.types';
import { Plus, SlidersHorizontal } from 'lucide-react';

interface Props {
  stock: MilkProductsDailyStock;
  onAddProduction: (qty: number) => void;
  onOpenDayEnd: () => void;
  onAddToCart?: (name: string, qty: number, unitPrice: number, total?: number) => void;
  /** Daily rate Rs/kg from Settings — prefills sell price (still editable) */
  defaultRatePerKg?: number;
}

export const LassiSection: React.FC<Props> = ({
  stock,
  onAddProduction,
  onOpenDayEnd,
  onAddToCart,
  defaultRatePerKg = 0,
}) => {
  const [prodInput, setProdInput] = useState('');
  const [salePrice, setSalePrice] = useState(
    defaultRatePerKg > 0 ? String(defaultRatePerKg) : ''
  );
  const [saleError, setSaleError] = useState('');

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
        : 70;

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
    onAddToCart?.('Lassi', weight, rate, total);
  };

  const handleAmountPreset = (amt: number) => {
    const rate = effectiveRate;
    if (!rate || rate <= 0) {
      setSaleError('Enter a valid rate per kg first.');
      return;
    }
    setSaleError('');
    const qty = parseFloat((amt / rate).toFixed(3));
    onAddToCart?.('Lassi', qty, rate, amt);
  };

  const [customType, setCustomType] = useState<'rs' | 'kg'>('kg');
  const [customAmount, setCustomAmount] = useState('');

  const handleCustomAdd = () => {
    const rate = effectiveRate;
    if (!rate || rate <= 0) {
      setSaleError('Enter a valid rate per kg first.');
      return;
    }
    const parsed = parseFloat(customAmount);
    if (!parsed || parsed <= 0) {
      setSaleError('Enter a valid amount > 0.');
      return;
    }
    setSaleError('');

    let kg = 0;
    let rs = 0;

    if (customType === 'rs') {
      rs = parsed;
      kg = parseFloat((rs / rate).toFixed(3));
    } else {
      kg = parsed;
      rs = Math.round(kg * rate * 100) / 100;
    }

    onAddToCart?.('Lassi', kg, rate, rs);
    setCustomAmount('');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800">
              Lassi
            </h3>
            <span className="bg-cyan-100 text-cyan-800 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
              Daily Product
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Rs. {effectiveRate.toLocaleString()} / kg &nbsp;|&nbsp; Stock:{' '}
            <span className="font-bold text-cyan-600">{stock.lassiRemaining} kg</span>
          </p>
        </div>
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Sell Section */}
        {onAddToCart && (
          <div className="space-y-2.5 pb-3 border-b border-slate-100">
            {/* RS / KG Toggle Input like Milk & Yogurt card */}
            <div className="flex items-center gap-1.5 bg-slate-50 rounded-xl p-1.5 border border-cyan-200 shadow-xs">
              <div className="flex bg-slate-200/80 rounded-lg p-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setCustomType('rs')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                    customType === 'rs'
                      ? 'bg-white text-cyan-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  RS
                </button>
                <button
                  type="button"
                  onClick={() => setCustomType('kg')}
                  className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                    customType === 'kg'
                      ? 'bg-white text-cyan-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  KG
                </button>
              </div>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => {
                  setCustomAmount(e.target.value);
                  setSaleError('');
                }}
                placeholder={customType === 'kg' ? 'kg amount' : 'Rs amount'}
                className="flex-1 min-w-0 px-2.5 py-1 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-cyan-500"
                onKeyDown={(e) => e.key === 'Enter' && handleCustomAdd()}
              />
              <button
                type="button"
                onClick={handleCustomAdd}
                className="bg-cyan-600 hover:bg-cyan-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 shadow-xs"
              >
                Add
              </button>
            </div>

            {/* Live Calculation Preview */}
            {parseFloat(customAmount) > 0 && (
              <div className="text-[11px] text-cyan-700 font-semibold px-1 flex items-center justify-between">
                <span>
                  {customType === 'kg'
                    ? `${customAmount} kg = Rs. ${(parseFloat(customAmount) * effectiveRate).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                    : `Rs. ${parseFloat(customAmount).toLocaleString()} = ${(parseFloat(customAmount) / effectiveRate).toFixed(3)} kg`}
                </span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Rate: Rs. {effectiveRate}/kg
                </span>
              </div>
            )}

            {saleError && <p className="text-xs text-red-500 px-1">{saleError}</p>}

            {/* 2x2 Weight Presets */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {[0.25, 0.5, 1, 2].map((w) => {
                const price = Math.round(w * effectiveRate);
                return (
                  <button
                    key={`lassi-w-${w}`}
                    type="button"
                    onClick={() => handleWeightPreset(w)}
                    className="border border-cyan-200/80 bg-cyan-50/40 hover:bg-cyan-100/70 hover:border-cyan-400 rounded-xl p-2.5 flex flex-col items-center justify-center transition-all shadow-sm active:scale-95 group"
                  >
                    <span className="font-bold text-slate-800 text-sm group-hover:text-cyan-800">
                      {w} kg
                    </span>
                    <span className="text-xs text-cyan-700 font-semibold mt-0.5">
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
                  key={`lassi-amt-${amt}`}
                  type="button"
                  onClick={() => handleAmountPreset(amt)}
                  className="border border-slate-200 bg-white hover:bg-cyan-600 hover:text-white hover:border-cyan-600 rounded-lg py-1.5 px-1 text-center font-bold text-xs text-slate-700 transition-all shadow-xs active:scale-95"
                >
                  {amt >= 1000 ? amt.toLocaleString() : amt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Stock Details */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Produced:</span>
            <span className="font-medium text-slate-800">{stock.lassiProduced} kg</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Sold:</span>
            <span className="font-medium text-slate-800">{stock.lassiSold} kg</span>
          </div>
          <div className="flex justify-between pt-1.5 border-t border-slate-100">
            <span className="font-bold text-slate-700">Remaining:</span>
            <span className="font-bold text-cyan-600">{stock.lassiRemaining} kg</span>
          </div>
        </div>

        {/* Production & Actions */}
        <div className="mt-auto space-y-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Production (kg)"
              className="flex-1 border border-slate-200 bg-white rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500"
              value={prodInput}
              onChange={(e) => setProdInput(e.target.value)}
            />
            <button
              onClick={handleProd}
              className="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 px-3 py-1.5 rounded-lg border border-cyan-200 text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            onClick={onOpenDayEnd}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white rounded-lg py-2 text-xs font-bold transition-colors"
          >
            End-of-Day Reconciliation
          </button>
        </div>
      </div>
    </div>
  );
};
