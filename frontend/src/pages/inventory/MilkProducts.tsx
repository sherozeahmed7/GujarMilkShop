import React, { useState, useEffect } from 'react';
import { MilkProductsDailyStock } from '../../types/milkProducts.types';
import { milkProductsService } from '../../services/milkProducts.service';
import { rateService } from '../../services/rate.service';
import { MilkSummary } from '../../components/milk-products/MilkSummary';
import { LassiSection } from '../../components/milk-products/LassiSection';
import { ButterSection } from '../../components/milk-products/ButterSection';
import { GheeSection } from '../../components/milk-products/GheeSection';
import { ButterGheeConversionModal } from '../../components/milk-products/ButterGheeConversionModal';
import { DayEndLassiModal } from '../../components/milk-products/DayEndLassiModal';
import { ProductHistory } from '../../components/milk-products/ProductHistory';
import { Calendar, Plus } from 'lucide-react';

export const MilkProducts: React.FC<{
  onAddToCart?: (name: string, qty: number, unitPrice: number, total?: number) => void;
  onRegisterRefresh?: (fn: () => void) => void;
}> = ({ onAddToCart, onRegisterRefresh }) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [stock, setStock] = useState<MilkProductsDailyStock | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoadingStock, setIsLoadingStock] = useState(true);
  const [f2Rates, setF2Rates] = useState({ lassi: 0, butter: 0, ghee: 0 });

  const [milkInput, setMilkInput] = useState('');

  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [isLassiModalOpen, setIsLassiModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const prices = await rateService.getStandardPrices();
        if (!cancelled) {
          setF2Rates({
            lassi: prices.lassiRatePerKg || 0,
            butter: prices.butterRatePerKg || 0,
            ghee: prices.gheeRatePerKg || 0,
          });
        }
      } catch {
        // keep zeros â€” cashier can still type Rs/kg
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Register loadData so POS can trigger a refresh after a sale
  useEffect(() => {
    onRegisterRefresh?.(loadData);
  }, [selectedDate]);

  const loadData = async () => {
    setIsLoadingStock(true);
    setLoadError(null);
    try {
      const data = await milkProductsService.getDailyStock(selectedDate);
      setStock(data);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to load stock data.');
    } finally {
      setIsLoadingStock(false);
    }
  };

  const handleAddMilk = async () => {
    const qty = parseFloat(milkInput);
    if (isNaN(qty) || qty <= 0) return;
    try {
      const updated = await milkProductsService.addMilk(selectedDate, qty);
      setStock(updated);
      setMilkInput('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLassiProd = async (qty: number) => {
    const updated = await milkProductsService.addLassiProduction(selectedDate, qty);
    setStock(updated);
  };

  const handleButterProd = async (qty: number) => {
    const updated = await milkProductsService.addButterProduction(selectedDate, qty);
    setStock(updated);
  };

  const handleGheeProd = async (qty: number) => {
    const updated = await milkProductsService.addGheeProduction(selectedDate, qty);
    setStock(updated);
  };

  if (isLoadingStock && !stock)
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        Loading stock dataâ€¦
      </div>
    );

  if (loadError && !stock)
    return (
      <div className="p-8 flex flex-col items-center justify-center gap-3">
        <p className="text-rose-600 font-medium text-sm">{loadError}</p>
        <button onClick={loadData} className="text-blue-600 hover:text-blue-700 font-medium text-sm">
          Retry
        </button>
      </div>
    );

  if (!stock)
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-slate-400 text-sm">
        <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        Loading stock dataâ€¦
      </div>
    );

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Milk Products / F2</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage production and inventory for Lassi, Butter, and Ghee
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1.5 border border-slate-200">
            <div className="pl-2 text-slate-500">
              <Calendar className="w-4 h-4" />
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent border-none text-sm font-medium text-slate-700 focus:outline-none focus:ring-0"
            />
          </div>

          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg p-1.5">
            <span className="text-xs font-bold text-blue-800 pl-2">Total Milk:</span>
            <input
              type="number"
              value={milkInput}
              onChange={(e) => setMilkInput(e.target.value)}
              placeholder="kg"
              className="w-16 bg-white border border-blue-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleAddMilk}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded p-1 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <MilkSummary stock={stock} />

          <div className="flex flex-wrap gap-6 items-stretch">
            <div className="w-full md:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)] min-w-[300px]">
              <LassiSection
                stock={stock}
                onAddProduction={handleLassiProd}
                onOpenDayEnd={() => setIsLassiModalOpen(true)}
                onAddToCart={onAddToCart}
                defaultRatePerKg={f2Rates.lassi}
              />
            </div>
            <div className="w-full md:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)] min-w-[300px]">
              <ButterSection
                stock={stock}
                onAddProduction={handleButterProd}
                onOpenConversion={() => setIsConversionModalOpen(true)}
                onAddToCart={onAddToCart}
                defaultRatePerKg={f2Rates.butter}
              />
            </div>
            <div className="w-full md:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)] min-w-[300px]">
              <GheeSection
                stock={stock}
                onAddProduction={handleGheeProd}
                onAddToCart={onAddToCart}
                defaultRatePerKg={f2Rates.ghee}
              />
            </div>
          </div>

          <ProductHistory date={selectedDate} />
        </div>
      </div>

      {isConversionModalOpen && (
        <ButterGheeConversionModal
          date={selectedDate}
          availableButter={stock.butterClosing}
          onClose={() => setIsConversionModalOpen(false)}
          onSuccess={loadData}
        />
      )}

      {isLassiModalOpen && (
        <DayEndLassiModal
          date={selectedDate}
          currentSold={stock.lassiSold}
          onClose={() => setIsLassiModalOpen(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
};

