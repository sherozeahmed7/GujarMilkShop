import React, { useState, useEffect } from 'react';
import { MilkProductsDailyStock } from '../../types/milkProducts.types';
import { milkProductsService } from '../../services/milkProducts.service';
import { MilkSummary } from '../../components/milk-products/MilkSummary';
import { LassiSection } from '../../components/milk-products/LassiSection';
import { ButterSection } from '../../components/milk-products/ButterSection';
import { GheeSection } from '../../components/milk-products/GheeSection';
import { ButterGheeConversionModal } from '../../components/milk-products/ButterGheeConversionModal';
import { DayEndLassiModal } from '../../components/milk-products/DayEndLassiModal';
import { ProductHistory } from '../../components/milk-products/ProductHistory';
import { Calendar, Plus } from 'lucide-react';

export const MilkProducts: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [stock, setStock] = useState<MilkProductsDailyStock | null>(null);
  
  const [milkInput, setMilkInput] = useState('');
  
  const [isConversionModalOpen, setIsConversionModalOpen] = useState(false);
  const [isLassiModalOpen, setIsLassiModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = async () => {
    try {
      const data = await milkProductsService.getDailyStock(selectedDate);
      setStock(data);
    } catch (err: any) {
      console.error('Failed to load stock data:', err.message);
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
  
  const handleLassiSale = async (qty: number) => {
    const updated = await milkProductsService.addLassiSale(selectedDate, qty);
    setStock(updated);
  };

  const handleButterProd = async (qty: number) => {
    const updated = await milkProductsService.addButterProduction(selectedDate, qty);
    setStock(updated);
  };

  const handleButterSale = async (qty: number) => {
    try {
      const updated = await milkProductsService.addButterSale(selectedDate, qty);
      setStock(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleGheeProd = async (qty: number) => {
    const updated = await milkProductsService.addGheeProduction(selectedDate, qty);
    setStock(updated);
  };

  const handleGheeSale = async (qty: number) => {
    try {
      const updated = await milkProductsService.addGheeSale(selectedDate, qty);
      setStock(updated);
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (!stock) return <div className="p-8 text-center text-slate-500">Loading...</div>;

  return (
    <div className="flex flex-col h-full bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Milk Products / F2</h1>
          <p className="text-sm text-slate-500 mt-1">Manage production and inventory for Lassi, Butter, and Ghee</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1.5 border border-slate-200">
            <div className="pl-2 text-slate-500"><Calendar className="w-4 h-4" /></div>
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
          
          {/* Changed to flex wrap to ensure cards don't squish */}
          <div className="flex flex-wrap gap-6 items-stretch">
            <div className="w-full md:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)] min-w-[300px]">
              <LassiSection 
                stock={stock} 
                onAddProduction={handleLassiProd} 
                onAddSale={handleLassiSale} 
                onOpenDayEnd={() => setIsLassiModalOpen(true)}
              />
            </div>
            <div className="w-full md:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)] min-w-[300px]">
              <ButterSection 
                stock={stock} 
                onAddProduction={handleButterProd} 
                onAddSale={handleButterSale} 
                onOpenConversion={() => setIsConversionModalOpen(true)}
              />
            </div>
            <div className="w-full md:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)] min-w-[300px]">
              <GheeSection 
                stock={stock} 
                onAddProduction={handleGheeProd} 
                onAddSale={handleGheeSale} 
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
