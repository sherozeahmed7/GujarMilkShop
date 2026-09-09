import React from 'react';
import { MilkProductsDailyStock } from '../../types/milkProducts.types';
import { Beaker, Coffee, Box, Archive, CircleDollarSign, Target, ShoppingCart, Scale, WalletCards, AlertTriangle, ArrowRightLeft, Droplets } from 'lucide-react';

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
          <p className="text-sm font-medium text-slate-500">Milk Cost Remaining</p>
          <h3 className="text-xl font-bold text-slate-800">Rs. {(stock.milkLossCost ?? 0).toLocaleString()}</h3>
          <p className="text-[11px] text-slate-400">after Lassi and Butter recovery</p>
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

      <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
          <Beaker className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Milk Added</p>
          <h3 className="text-xl font-bold text-slate-800">{stock.milkTotal} kg</h3>
          <p className="text-[11px] text-slate-400">milk added today</p>
        </div>
      </div>
      
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
          <Box className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Butter Stock (kg)</p>
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

      <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <CircleDollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Added Milk Cost</p>
            <h3 className="text-xl font-bold text-slate-800">Rs. {(stock.milkAddedCost ?? 0).toLocaleString()}</h3>
            <p className="text-[11px] text-slate-400">{stock.milkTotal} kg at supplier cost Rs. {stock.milkCostPerKg ?? stock.milkRatePerKg ?? 0}/kg</p>
          </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Lassi to Sell for Milk Cost</p>
            <h3 className="text-xl font-bold text-slate-800">{(stock.lassiBreakEvenKg ?? 0).toLocaleString()} kg</h3>
            <p className="text-[11px] text-slate-400">sell this much to recover milk cost</p>
          </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-cyan-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-cyan-50 text-cyan-600 rounded-lg">
          <ShoppingCart className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Lassi Sold Today</p>
          <h3 className="text-xl font-bold text-slate-800">{stock.lassiSold} kg</h3>
            <p className="text-[11px] text-cyan-700 font-semibold">
              Rs. {Math.round(stock.lassiSold * (stock.lassiRatePerKg ?? 0)).toLocaleString()} sold value
            </p>
            <p className="text-[11px] text-slate-400">quantity and amount sold so far</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-amber-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
          <Scale className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Butter to Sell for Milk Cost</p>
          <h3 className="text-xl font-bold text-slate-800">{(stock.butterBreakEvenKg ?? 0).toLocaleString()} kg</h3>
          <p className="text-[11px] text-slate-400">worth Rs. {(stock.butterBreakEvenCost ?? 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
          <WalletCards className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Butter Stock Value (Rs.)</p>
          <h3 className="text-xl font-bold text-slate-800">Rs. {(stock.butterInventoryValue ?? 0).toLocaleString()}</h3>
          <p className="text-[11px] text-slate-400">{stock.butterClosing} kg at Rs. {stock.butterRatePerKg ?? 0}/kg</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Milk Cost Still Uncovered</p>
          <h3 className="text-xl font-bold text-slate-800">Rs. {(stock.butterMilkCostShortfall ?? 0).toLocaleString()}</h3>
          <p className="text-[11px] text-slate-400">after selling all Butter in stock</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-violet-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-violet-50 text-violet-600 rounded-lg">
          <ArrowRightLeft className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Butter Converted Today</p>
          <h3 className="text-xl font-bold text-slate-800">{stock.butterConverted} kg</h3>
          <p className="text-[11px] text-slate-400">used for Ghee production</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
          <Droplets className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Ghee Produced Today</p>
          <h3 className="text-xl font-bold text-slate-800">{stock.gheeProduced} kg</h3>
          <p className="text-[11px] text-slate-400">from Butter conversion</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-violet-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-violet-50 text-violet-600 rounded-lg">
          <Target className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Ghee Yield</p>
          <h3 className="text-xl font-bold text-slate-800">
            {stock.butterConverted > 0
              ? `${((stock.gheeProduced / stock.butterConverted) * 100).toFixed(1)}%`
              : '0%'}
          </h3>
          <p className="text-[11px] text-slate-400">Ghee produced from Butter used</p>
        </div>
      </div>

      <div className={`bg-white p-4 rounded-xl border shadow-sm flex items-center gap-4 ${
        stock.milkAddedCost === 0 || (stock.butterRecoveryResult ?? 0) >= 0 ? 'border-emerald-100' : 'border-rose-100'
      }`}>
        <div className={`p-3 rounded-lg ${stock.milkAddedCost === 0 || (stock.butterRecoveryResult ?? 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {stock.milkAddedCost === 0 || (stock.butterRecoveryResult ?? 0) >= 0 ? <CircleDollarSign className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">Butter + Lassi Value vs Milk Cost</p>
          <h3 className={`text-xl font-bold ${stock.milkAddedCost === 0 || (stock.butterRecoveryResult ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {stock.milkAddedCost === 0 ? 'No milk cost' : `${(stock.butterRecoveryResult ?? 0) >= 0 ? 'Profit' : 'Loss'}: Rs. ${Math.abs(stock.butterRecoveryResult ?? 0).toLocaleString()}`}
          </h3>
          <p className="text-[11px] text-slate-400">Rs. {(stock.butterTotalValue ?? 0).toLocaleString()} combined recovery value</p>
        </div>
      </div>
    </div>
  );
};
