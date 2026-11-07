import React, { useState, useEffect } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { NumericKeypadInput } from '../pos/NumericKeypadInput';
import { Product } from '../../types/inventory';

interface Props {
  product: Product;
  onAddToCart?: (name: string, qty: number, unitPrice: number, total?: number) => void;
}

const WEIGHT_PRESETS = [0.25, 0.5, 1, 2];
const PCS_PRESETS = [1, 3, 6, 12];
const AMOUNT_PRESETS = [100, 250, 500, 1000];

export const CustomProductCard: React.FC<Props> = ({ product, onAddToCart }) => {
  const [saleQty, setSaleQty] = useState('');
  const [salePrice, setSalePrice] = useState(
    product.sellPrice > 0 ? String(product.sellPrice) : ''
  );
  const [saleError, setSaleError] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  useEffect(() => {
    if (product.sellPrice > 0) {
      setSalePrice(String(product.sellPrice));
    }
  }, [product.sellPrice]);

  const isPcs = product.unit?.toLowerCase() === 'pcs' || product.unit?.toLowerCase() === 'pieces';
  const isWeightUnit = !isPcs; // kg, ltr, etc.

  const effectiveRate =
    parseFloat(salePrice) > 0
      ? parseFloat(salePrice)
      : product.sellPrice > 0
        ? product.sellPrice
        : 0;

  const availableStock = Number(product.stock) || 0;
  const unitLabel = product.unit || 'unit';

  // --- PCS handlers ---
  const handlePcsPreset = (count: number) => {
    const rate = effectiveRate;
    if (!rate || rate <= 0) {
      setSaleError('Enter a valid rate first.');
      return;
    }
    setSaleError('');
    const total = Math.round(count * rate * 100) / 100;
    onAddToCart?.(product.name, count, rate, total);
  };

  // --- Weight handlers ---
  const handleWeightPreset = (weight: number) => {
    const rate = effectiveRate;
    if (!rate || rate <= 0) {
      setSaleError('Enter a valid rate first.');
      return;
    }
    setSaleError('');
    const total = Math.round(weight * rate * 100) / 100;
    onAddToCart?.(product.name, weight, rate, total);
  };

  const handleAmountPreset = (amt: number) => {
    const rate = effectiveRate;
    if (!rate || rate <= 0) {
      setSaleError('Enter a valid rate first.');
      return;
    }
    setSaleError('');
    const qty = parseFloat((amt / rate).toFixed(3));
    onAddToCart?.(product.name, qty, rate, amt);
  };

  // --- Custom handler ---
  const handleAddToCart = (qtyOverride?: string) => {
    const qty = parseFloat(qtyOverride ?? saleQty);
    const price = parseFloat(salePrice) || effectiveRate;
    if (!qty || qty <= 0 || !price || price <= 0) {
      setSaleError('Enter a valid quantity and price > 0.');
      return;
    }
    setSaleError('');
    onAddToCart?.(product.name, qty, price, Math.round(qty * price * 100) / 100);
    setSaleQty('');
  };

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-xl border border-slate-200 dark:border-[#2d4a35] shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 dark:bg-[#142119] border-b border-slate-200 dark:border-[#2d4a35] px-4 py-3 flex justify-between items-center">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800 dark:text-[#e2f5e8]">
              {product.name}
            </h3>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
              {isPcs ? 'PIECES' : unitLabel.toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-[#8ba895] mt-0.5">
            Rs. {effectiveRate > 0 ? effectiveRate.toLocaleString() : '—'} / {unitLabel}
            {onAddToCart && (
              <>
                {' '}&nbsp;|&nbsp; Inventory:{' '}
                <span className={`font-bold ${availableStock > 0 ? 'text-orange-600' : 'text-rose-600'}`}>
                  {availableStock} {unitLabel}
                </span>
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
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white dark:bg-[#1a2e1f] text-slate-700 dark:text-[#e2f5e8] border-slate-200 dark:border-[#2d4a35] hover:bg-slate-100 dark:hover:bg-[#1e3124]'
            }`}
          >
            <SlidersHorizontal className="w-3 h-3" />
            Custom
          </button>
        )}
      </div>

      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Quick Presets */}
        {onAddToCart && (
          <div className="space-y-2.5 pb-3 border-b border-slate-100 dark:border-[#2d4a35]">
            {isPcs ? (
              /* Pieces: 1x4 grid of pcs presets */
              <div className="grid grid-cols-4 gap-1.5">
                {PCS_PRESETS.map((count) => {
                  const price = effectiveRate > 0 ? Math.round(count * effectiveRate) : null;
                  return (
                    <button
                      key={`${product.id}-pcs-${count}`}
                      type="button"
                      onClick={() => handlePcsPreset(count)}
                      className="border border-emerald-200/80 bg-emerald-50/40 hover:bg-emerald-100/70 hover:border-emerald-400 rounded-xl p-2.5 flex flex-col items-center justify-center transition-all shadow-sm active:scale-95 group"
                    >
                      <span className="font-bold text-slate-800 dark:text-[#e2f5e8] text-sm group-hover:text-emerald-800">
                        {count} pcs
                      </span>
                      {price !== null && (
                        <span className="text-xs text-emerald-700 font-semibold mt-0.5">
                          Rs. {price.toLocaleString()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <>
                {/* Weight unit: 2x2 weight presets */}
                <div className="grid grid-cols-2 gap-2">
                  {WEIGHT_PRESETS.map((w) => {
                    const price = effectiveRate > 0 ? Math.round(w * effectiveRate) : null;
                    return (
                      <button
                        key={`${product.id}-w-${w}`}
                        type="button"
                        onClick={() => handleWeightPreset(w)}
                        className="border border-orange-200/80 bg-orange-50/40 hover:bg-orange-100/70 hover:border-orange-400 rounded-xl p-2.5 flex flex-col items-center justify-center transition-all shadow-sm active:scale-95 group"
                      >
                        <span className="font-bold text-slate-800 dark:text-[#e2f5e8] text-sm group-hover:text-orange-800">
                          {w} {unitLabel}
                        </span>
                        {price !== null && (
                          <span className="text-xs text-orange-700 font-semibold mt-0.5">
                            Rs. {price.toLocaleString()}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Rupee amount presets */}
                <div className="grid grid-cols-4 gap-1.5">
                  {AMOUNT_PRESETS.map((amt) => (
                    <button
                      key={`${product.id}-amt-${amt}`}
                      type="button"
                      onClick={() => handleAmountPreset(amt)}
                      className="border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#1a2e1f] hover:bg-orange-500 hover:text-white hover:border-orange-500 rounded-lg py-1.5 px-1 text-center font-bold text-xs text-slate-700 dark:text-[#e2f5e8] transition-all shadow-xs active:scale-95"
                    >
                      {amt >= 1000 ? amt.toLocaleString() : amt}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Custom input (collapsible) */}
            {showCustom && (
              <div className="space-y-2 pt-2 border-t border-dashed border-emerald-200">
                <p className="text-[11px] font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wide">
                  Custom Quantity &amp; Rate
                </p>
                <div className="flex items-center gap-2">
                  <NumericKeypadInput
                    value={saleQty}
                    onChange={(v) => { setSaleQty(v); setSaleError(''); }}
                    onConfirm={(v) => handleAddToCart(v)}
                    placeholder={`Qty (${unitLabel})`}
                    title={`${product.name} quantity`}
                    accent="emerald"
                    confirmLabel="+ Cart"
                    className="flex-1 min-w-0"
                    triggerClassName={`text-xs py-1.5 border rounded-lg bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] ${
                      saleError ? 'border-red-400' : 'border-slate-200 dark:border-[#2d4a35]'
                    }`}
                  />
                  <NumericKeypadInput
                    value={salePrice}
                    onChange={(v) => { setSalePrice(v); setSaleError(''); }}
                    placeholder={`Rs/${unitLabel}`}
                    title={`${product.name} rate`}
                    accent="emerald"
                    confirmLabel="OK"
                    className="w-24 shrink-0"
                    triggerClassName={`text-xs py-1.5 border rounded-lg bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] ${
                      saleError ? 'border-red-400' : 'border-slate-200 dark:border-[#2d4a35]'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddToCart()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
                  >
                    + Cart
                  </button>
                </div>
                {saleError && <p className="text-xs text-red-500">{saleError}</p>}
              </div>
            )}
          </div>
        )}

        {/* Stock details */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-500 dark:text-[#8ba895]">
            <span>Stock:</span>
            <span className={`font-bold ${availableStock > 0 ? 'text-slate-800 dark:text-[#e2f5e8]' : 'text-rose-600'}`}>
              {availableStock} {unitLabel}
            </span>
          </div>
          {product.category && (
            <div className="flex justify-between text-slate-500 dark:text-[#8ba895]">
              <span>Category:</span>
              <span className="font-medium text-slate-700 dark:text-[#c4deca]">{product.category}</span>
            </div>
          )}
          <div className="flex justify-between pt-1.5 border-t border-slate-100 dark:border-[#2d4a35]">
            <span className="font-bold text-slate-700 dark:text-[#e2f5e8]">Inventory stock:</span>
            <span className={`font-bold ${availableStock > 0 ? 'text-orange-600' : 'text-rose-600'}`}>
              {availableStock} {unitLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
