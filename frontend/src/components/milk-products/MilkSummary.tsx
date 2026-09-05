import React from 'react';
import { MilkProductsDailyStock } from '../../types/milkProducts.types';
import { Beaker, Coffee, Box, Archive } from 'lucide-react';

interface Props {
  stock: MilkProductsDailyStock;
}

export const MilkSummary: React.FC<Props> = ({ stock }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
          <Beaker className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Total Milk</p>
          <h3 className="text-xl font-bold text-slate-800">{stock.milkTotal} kg</h3>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-cyan-50 text-cyan-600 rounded-lg">
          <Coffee className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Lassi Inventory</p>
          <h3 className="text-xl font-bold text-slate-800">{stock.lassiRemaining} kg</h3>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
          <Box className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Butter Inventory</p>
          <h3 className="text-xl font-bold text-slate-800">{stock.butterClosing} kg</h3>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
          <Archive className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Ghee Inventory</p>
          <h3 className="text-xl font-bold text-slate-800">{stock.gheeClosing} kg</h3>
        </div>
      </div>
    </div>
  );
};
