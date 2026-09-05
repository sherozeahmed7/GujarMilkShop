
import React, { useEffect, useState } from 'react';
import { MilkProductsDailyStock } from '../../types/milkProducts.types';
import { SlidersHorizontal } from 'lucide-react';
import { NumericKeypadInput } from '../pos/NumericKeypadInput';

interface Props {
  stock: MilkProductsDailyStock;
  /** Sellable stock from Inventory screen (authoritative for POS sales) */
  inventoryStockKg?: number;
  onOpenConversion: () => void;
  onAddToCart?: (name: string, qty: number, unitPrice: number, total?: number) => void;
  defaultRatePerKg?: number;
}

export const ButterSection: React.FC<Props> = ({
  stock,
  inventoryStockKg = 0,
  onOpenConversion,
  onAddToCart,
  defaultRatePerKg = 0,
}) => {
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

  const availableKg = Number(inventoryStockKg) || 0;

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

  const handleAddToCart = (qtyOverride?: string) => {
    const qty = parseFloat(qtyOverride ?? saleQty);
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
            Rs. {effectiveRate.toLocaleString()} / kg
            {onAddToCart ? (
              <>
                {' '}&nbsp;|&nbsp; Inventory:{' '}
                <span className={`font-bold ${availableKg > 0 ? 'text-amber-600' : 'text-rose-600'}`}>
                  {availableKg} kg
                </span>
              </>
            ) : (
              <>
                {' '}&nbsp;|&nbsp; F2:{' '}
                <span className="font-bold text-amber-600">{stock.butterClosing} kg</span>
              </>
            )}
          </p>
          {onAddToCart && saleError && (
            <p className="text-[11px] text-rose-600 font-medium mt-1 max-w-xs">{saleError}</p>
          )}
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
                  <NumericKeypadInput
                    value={saleQty}
                    onChange={(v) => {
                      setSaleQty(v);
                      setSaleError('');
                    }}
                    onConfirm={(v) => handleAddToCart(v)}
                    placeholder="Qty (kg)"
                    title="Butter quantity"
                    accent="amber"
                    confirmLabel="+ Cart"
                    className="flex-1 min-w-0"
                    triggerClassName={`text-xs py-1.5 border rounded-lg bg-white ${
                      saleError ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  <NumericKeypadInput
                    value={salePrice}
                    onChange={(v) => {
                      setSalePrice(v);
                      setSaleError('');
                    }}
                    placeholder="Rs/kg"
                    title="Butter rate"
                    accent="amber"
                    confirmLabel="OK"
                    className="w-24 shrink-0"
                    triggerClassName={`text-xs py-1.5 border rounded-lg bg-white ${
                      saleError ? 'border-red-400' : 'border-slate-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddToCart()}
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

        {/* Stock Details — from Inventory (exact) */}
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
            <span className="font-bold text-slate-700">Inventory stock:</span>
            <span className="font-bold text-amber-600">{stock.butterClosing} kg</span>
          </div>
        </div>

        <div className="mt-auto space-y-2.5 pt-2 border-t border-slate-100">
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
