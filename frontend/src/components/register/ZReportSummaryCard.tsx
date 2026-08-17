import React from 'react';
import { RegisterData } from '../../types';

interface ZReportSummaryCardProps {
  data: RegisterData;
}

function formatTime(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function calculateHours(start?: string, end?: string) {
  if (!start || !end) return '—';
  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  const hours = (diffMs / (1000 * 60 * 60)).toFixed(2);
  return `${hours} hours`;
}

export const ZReportSummaryCard: React.FC<ZReportSummaryCardProps> = ({ data }) => {
  return (
    <div className="bg-slate-800 rounded-2xl shadow-lg border border-slate-700 overflow-hidden relative">
      {/* Decorative gradient */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-400 to-emerald-500"></div>
      
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6">
          
          {/* Left Column */}
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Cashier</span>
              <span className="font-bold text-white">{data.cashier}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Shift Open</span>
              <span className="font-bold text-white">{formatTime(data.shiftOpen)}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Shift Close</span>
              <span className="font-bold text-white">{formatTime(data.shiftClose)}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Total Hours Open</span>
              <span className="font-bold text-white">
                {data.shiftClose ? calculateHours(data.shiftOpen, data.shiftClose) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Bills Count</span>
              <span className="font-bold text-white">{data.billsCount}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Gross Sales</span>
              <span className="font-bold text-white">Rs. {data.grossSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Discounts</span>
              <span className="font-bold text-rose-400">- Rs. {data.discounts.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Refunds</span>
              <span className="font-bold text-rose-400">- Rs. {data.refunds.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Voids</span>
              <span className="font-bold text-white">{data.voids} bills</span>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Opening Cash</span>
              <span className="font-bold text-white">Rs. {data.openingBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Cash Sales</span>
              <span className="font-bold text-emerald-400">Rs. {data.cashSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Online Sales</span>
              <span className="font-bold text-white">Rs. {data.onlineSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Khata / Credit Sales</span>
              <span className="font-bold text-white">Rs. {data.khataSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-400">Expenses</span>
              <span className="font-bold text-rose-400">- Rs. {data.expenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2 mt-4 pt-4">
              <span className="font-bold text-slate-300">Expected Cash</span>
              <span className="font-bold text-emerald-400 text-lg">Rs. {data.expectedCash.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-700/50 pb-2">
              <span className="font-bold text-slate-300">Counted Cash</span>
              <span className="font-bold text-white">
                {data.countedCash !== undefined ? `Rs. ${data.countedCash.toLocaleString()}` : 'Not counted'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm pb-2">
              <span className="font-bold text-slate-300">Variance</span>
              <span className={`font-bold ${data.variance !== undefined ? (data.variance < 0 ? 'text-rose-400' : data.variance > 0 ? 'text-amber-400' : 'text-emerald-400') : 'text-slate-400'}`}>
                {data.variance !== undefined ? `Rs. ${data.variance.toLocaleString()}` : 'Not counted'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
