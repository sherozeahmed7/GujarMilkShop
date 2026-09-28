import React from "react";
import { MilkProductsDailyStock } from "../../types/milkProducts.types";
import {
  Beaker,
  Coffee,
  Box,
  Archive,
  CircleDollarSign,
  Target,
  ShoppingCart,
  Scale,
  WalletCards,
  AlertTriangle,
  ArrowRightLeft,
  Droplets,
} from "lucide-react";

interface Props {
  stock: MilkProductsDailyStock;
  periodLabel?: string;
}

export const MilkSummary: React.FC<Props> = ({ stock, periodLabel = 'today' }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-slate-200 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
          <Beaker className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Milk Cost</p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">Rs. {(stock.milkLossCost ?? 0).toLocaleString()}</h3>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">after Lassi and Butter recovery</p>
        </div>
      </div> */}

      <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-blue-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
          <Beaker className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Milk Added</p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            {stock.milkTotal} kg
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">milk added for {periodLabel.toLowerCase()}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-blue-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
          <CircleDollarSign className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Added Milk Cost</p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            Rs. {(stock.milkAddedCost ?? 0).toLocaleString()}
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
            {stock.milkTotal} kg at supplier cost Rs.{" "}
            {stock.milkCostPerKg ?? stock.milkRatePerKg ?? 0}/kg
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-slate-200 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
        <div className="p-3 bg-cyan-50 text-cyan-600 rounded-lg">
          <Coffee className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Lassi Inventory</p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            {stock.lassiRemaining} kg
          </h3>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-slate-200 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
          <Box className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">
            Butter Stock (kg)
          </p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            {stock.butterClosing} kg
          </h3>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-slate-200 dark:border-[#2d4a35] shadow-sm flex items-center gap-4">
        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
          <Archive className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Ghee Inventory</p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            {stock.gheeClosing} kg
          </h3>
        </div>
      </div>

      {/* <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-amber-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
          <Target className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">
            Lassi to Sell for Milk Cost
          </p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            {(stock.lassiBreakEvenKg ?? 0).toLocaleString()} kg
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
            sell this much to recover milk cost
          </p>
        </div>
      </div> */}

      <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-cyan-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-cyan-50 text-cyan-600 rounded-lg">
          <ShoppingCart className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Lassi Sold ({periodLabel})</p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            {stock.lassiSold} kg
          </h3>
          <p className="text-[11px] text-cyan-700 font-semibold">
            Rs.{" "}
            {Math.round(
              stock.lassiSold * (stock.lassiRatePerKg ?? 0),
            ).toLocaleString()}{" "}
            sold value
          </p>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
            quantity and amount sold for {periodLabel.toLowerCase()}
          </p>
        </div>
      </div>

      {/* <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-amber-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
          <Scale className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">
            Butter to Sell for Milk Cost
          </p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            {(stock.butterBreakEvenKg ?? 0).toLocaleString()} kg
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
            worth Rs. {(stock.butterBreakEvenCost ?? 0).toLocaleString()}
          </p>
        </div>
      </div> */}

      {/* <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-orange-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
          <WalletCards className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">
            Butter Stock Value (Rs.)
          </p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            Rs. {(stock.butterInventoryValue ?? 0).toLocaleString()}
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
            {stock.butterClosing} kg at Rs. {stock.butterRatePerKg ?? 0}/kg
          </p>
        </div>
      </div> */}

      {/* <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-rose-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">
            Milk Cost Still Uncovered
          </p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            Rs. {(stock.butterMilkCostShortfall ?? 0).toLocaleString()}
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
            after selling all Butter in stock
          </p>
        </div>
      </div> */}

      <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-violet-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-violet-50 text-violet-600 rounded-lg">
          <ArrowRightLeft className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">
            Butter Converted ({periodLabel})
          </p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            {stock.butterConverted} kg
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">used for Ghee production in {periodLabel.toLowerCase()}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-orange-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-orange-50 text-orange-600 rounded-lg">
          <Droplets className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">
            Ghee Produced 
          </p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            {stock.gheeProduced} kg
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">from Butter conversion in {periodLabel.toLowerCase()}</p>
        </div>
      </div>
{/* 
      <div className="bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border border-violet-100 shadow-sm flex items-center gap-4">
        <div className="p-3 bg-violet-50 text-violet-600 rounded-lg">
          <Target className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">Ghee Yield</p>
          <h3 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">
            {stock.butterConverted > 0
              ? `${((stock.gheeProduced / stock.butterConverted) * 100).toFixed(1)}%`
              : "0%"}
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
            Ghee produced from Butter used
          </p>
        </div>
      </div> */}

      <div
        className={`bg-white dark:bg-[#1a2e1f] p-4 rounded-xl border shadow-sm flex items-center gap-4 ${
          stock.milkAddedCost === 0 || (stock.butterRecoveryResult ?? 0) >= 0
            ? "border-emerald-100"
            : "border-rose-100"
        }`}
      >
        <div
          className={`p-3 rounded-lg ${stock.milkAddedCost === 0 || (stock.butterRecoveryResult ?? 0) >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}
        >
          {stock.milkAddedCost === 0 ||
          (stock.butterRecoveryResult ?? 0) >= 0 ? (
            <CircleDollarSign className="w-6 h-6" />
          ) : (
            <AlertTriangle className="w-6 h-6" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500 dark:text-[#8ba895]">
          Profit and Loss
          </p>
          <h3
            className={`text-xl font-bold ${stock.milkAddedCost === 0 || (stock.butterRecoveryResult ?? 0) >= 0 ? "text-emerald-700" : "text-rose-700"}`}
          >
            {stock.milkAddedCost === 0
              ? "No milk cost"
              : `${(stock.butterRecoveryResult ?? 0) >= 0 ? "Profit" : "Loss"}: Rs. ${Math.abs(stock.butterRecoveryResult ?? 0).toLocaleString()}`}
          </h3>
          <p className="text-[11px] text-slate-400 dark:text-[#64916e]">
            Rs. {(stock.butterTotalValue ?? 0).toLocaleString()} combined
            recovery value
          </p>
        </div>
      </div>
    </div>
  );
};
