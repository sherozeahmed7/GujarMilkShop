import React from "react";
import { MilkProductsDailyStock } from "../../types/milkProducts.types";
import {
  Beaker,
  Coffee,
  Box,
  Archive,
  CircleDollarSign,
  Droplets,
  Coins,
  TrendingUp,
  TrendingDown,
  Layers,
  Scale,
} from "lucide-react";

interface Props {
  stock: MilkProductsDailyStock;
  periodLabel?: string;
}

export const MilkSummary: React.FC<Props> = ({ stock, periodLabel = 'today' }) => {
  // Calculations & Fallbacks
  const milkAdded = stock.milkTotal ?? 0;
  const milkCostRate = stock.milkCostPerKg ?? stock.milkRatePerKg ?? 0;
  const addedMilkCost = stock.milkAddedCost ?? Math.round(milkAdded * milkCostRate);

  const butterProduced = stock.butterProduced ?? 0;
  const butterClosing = stock.butterClosing ?? 0;
  const butterRate = stock.butterRatePerKg ?? 0;
  const effectiveButterKg = butterProduced > 0 ? butterProduced : butterClosing;
  const butterPriceValue = stock.butterPriceValue ?? Math.round(effectiveButterKg * butterRate);

  const lassiProduced = stock.lassiProduced ?? 0;
  const lassiRemaining = stock.lassiRemaining ?? 0;
  const lassiRate = stock.lassiRatePerKg ?? 0;
  const lassiPriceValue = stock.lassiPriceValue ?? Math.round(lassiProduced * lassiRate);

  const totalButterLassiPrice = stock.totalButterLassiPrice ?? (butterPriceValue + lassiPriceValue);

  const butterLassiProfitLoss = stock.butterLassiProfitLoss ?? (totalButterLassiPrice - addedMilkCost);
  const isProfit = butterLassiProfitLoss >= 0;

  const butterCostPerKg = stock.butterCostPerKg ?? (effectiveButterKg > 0 && addedMilkCost > 0 ? Math.round(addedMilkCost / effectiveButterKg) : 0);
  const remainingButterWeight = stock.butterClosing ?? 0;
  const remainingButterCost = stock.remainingButterCost ?? Math.round(remainingButterWeight * butterCostPerKg);

  const butterConverted = stock.butterConverted ?? 0;
  const gheeProduced = stock.gheeProduced ?? 0;
  const gheeClosing = stock.gheeClosing ?? 0;
  const gheeRate = stock.gheeRatePerKg ?? 0;
  const gheeCostPerKg = stock.gheeCostPerKg ?? (butterCostPerKg > 0 ? Math.round(butterCostPerKg * 1.25) : 0);
  const effectiveGheeKg = gheeProduced > 0 ? gheeProduced : gheeClosing;
  const gheeTotalCost = stock.gheeTotalCost ?? Math.round(effectiveGheeKg * gheeCostPerKg);
  const gheeTotalSellValue = stock.gheeTotalSellValue ?? Math.round(effectiveGheeKg * gheeRate);

  return (
    <div className="space-y-4">
      {/* ─── SECTION 1: PHYSICAL WEIGHTS / PRODUCTION (KG CARDS) ─── */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba895] mb-2 px-1">
          Production & Stock Weights (kg)
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Milk Added (kg) */}
          <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-blue-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
              <Beaker className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Milk Added (kg)</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
                {milkAdded} kg
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#64916e]">Sent to F2 for {periodLabel.toLowerCase()}</p>
            </div>
          </div>

          {/* Butter In Stock / Produced (kg) */}
          <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-amber-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Butter (kg)</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
                {butterClosing} kg
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
                {butterProduced > 0 ? `+${butterProduced} kg produced today` : `Current stock in fridge`}
              </p>
            </div>
          </div>

          {/* Lassi Produced / Remaining (kg) */}
          <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-cyan-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
            <div className="p-3 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 rounded-lg">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Lassi (kg)</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
                {lassiProduced} kg
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
                {lassiRemaining} kg remaining
              </p>
            </div>
          </div>

          {/* Ghee In Stock / Produced (kg) */}
          <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-orange-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-lg">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Ghee (kg)</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
                {gheeClosing} kg
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
                {gheeProduced > 0 ? `+${gheeProduced} kg produced today` : `Current stock in storage`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: COSTS, MARKET VALUES & PROFIT/LOSS ─── */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba895] mb-2 px-1">
          Financial Valuation & P&L
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Added Milk Cost */}
          <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-blue-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 rounded-lg">
              <CircleDollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Added Milk Cost</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
                Rs. {addedMilkCost.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
                {milkAdded} kg @ supplier rate Rs. {milkCostRate}/kg
              </p>
            </div>
          </div>

          {/* Butter Price Value */}
          <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-amber-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
              <Box className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Butter Price Value</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
                Rs. {butterPriceValue.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
                {butterProduced > 0 ? butterProduced : butterClosing} kg @ Rs. {butterRate}/kg{butterProduced === 0 && butterClosing > 0 ? ' (stock)' : ''}
              </p>
            </div>
          </div>

          {/* Lassi Price Value */}
          <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-cyan-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
            <div className="p-3 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400 rounded-lg">
              <Coffee className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Lassi Price Value</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
                Rs. {lassiPriceValue.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
                {lassiProduced} kg @ Rs. {lassiRate}/kg
              </p>
            </div>
          </div>

          {/* Total Butter + Lassi Price */}
          <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-indigo-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Total Butter + Lassi</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
                Rs. {totalButterLassiPrice.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
                Combined market worth of production
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: PROFIT & LOSS & REMAINING BUTTER COST ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
        {/* Profit and Loss: Total (Butter + Lassi) - Added Milk Cost */}
        <div
          className={`bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border shadow-sm flex items-center gap-4 ${
            isProfit ? "border-emerald-200 dark:border-emerald-800/40" : "border-rose-200 dark:border-rose-800/40"
          }`}
        >
          <div className={`p-3 rounded-lg ${isProfit ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"}`}>
            {isProfit ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">P&L (Butter + Lassi)</p>
            <h3 className={`text-xl font-bold ${isProfit ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}`}>
              {addedMilkCost === 0 && totalButterLassiPrice === 0
                ? "No production"
                : `${isProfit ? "Profit" : "Loss"}: Rs. ${Math.abs(butterLassiProfitLoss).toLocaleString()}`}
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
              (Butter + Lassi Value) − Added Milk Cost
            </p>
          </div>
        </div>

        {/* Remaining Butter Cost Card */}
        <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-amber-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-lg">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Remaining Butter Cost</p>
            <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
              Rs. {remainingButterCost.toLocaleString()}
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
              {remainingButterWeight} kg remaining @ cost Rs. {butterCostPerKg}/kg
            </p>
          </div>
        </div>
      </div>

      {/* ─── SECTION 4: GHEE VALUATION CARDS ─── */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba895] mb-2 px-1">
          Ghee Valuation & Conversion
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card 1: Ghee Cost per kg */}
          <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-orange-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-lg">
              <Droplets className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Ghee Cost (per kg)</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
                Rs. {gheeCostPerKg.toLocaleString()} / kg
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
                From {butterConverted} kg butter converted
              </p>
            </div>
          </div>

          {/* Card 2: Ghee Cost * Ghee Weight (Total Ghee Cost) */}
          <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-orange-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
            <div className="p-3 bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 rounded-lg">
              <Archive className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Ghee Total Cost</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
                Rs. {gheeTotalCost.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
                Cost (Rs. {gheeCostPerKg}) × {gheeProduced > 0 ? gheeProduced : gheeClosing} kg {gheeProduced === 0 && gheeClosing > 0 ? '(stock)' : 'produced'}
              </p>
            </div>
          </div>

          {/* Card 3: Ghee Sell Price * Ghee Weight (Total Ghee Sell Value) */}
          <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-emerald-100 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
              <CircleDollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Ghee Sell Value</p>
              <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
                Rs. {gheeTotalSellValue.toLocaleString()}
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
                Sell price (Rs. {gheeRate}) × {gheeProduced > 0 ? gheeProduced : gheeClosing} kg {gheeProduced === 0 && gheeClosing > 0 ? '(stock)' : 'produced'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
