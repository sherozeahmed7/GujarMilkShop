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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
      {/* Decorative gradient */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-400 to-emerald-500"></div>
      
      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6">
          
          {/* Left Column */}
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Cashier</span>
              <span className="font-bold text-slate-800">{data.cashier}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Shift Open</span>
              <span className="font-bold text-slate-800">{formatTime(data.shiftOpen)}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Shift Close</span>
              <span className="font-bold text-slate-800">{formatTime(data.shiftClose)}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Total Hours Open</span>
              <span className="font-bold text-slate-800">
                {data.shiftClose ? calculateHours(data.shiftOpen, data.shiftClose) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Bills Count</span>
              <span className="font-bold text-slate-800">{data.billsCount}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Gross Sales</span>
              <span className="font-bold text-slate-800">Rs. {data.grossSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Discounts</span>
              <span className="font-bold text-rose-600">- Rs. {data.discounts.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Refunds</span>
              <span className="font-bold text-rose-600">- Rs. {data.refunds.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Voids</span>
              <span className="font-bold text-slate-800">{data.voids} bills</span>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Opening Cash</span>
              <span className="font-bold text-slate-800">Rs. {data.openingBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Cash Sales</span>
              <span className="font-bold text-emerald-600">Rs. {data.cashSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Online Sales</span>
              <span className="font-bold text-slate-800">Rs. {data.onlineSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Khata / Credit Sales</span>
              <span className="font-bold text-slate-800">Rs. {data.khataSales.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-500">Expenses</span>
              <span className="font-bold text-rose-600">- Rs. {data.expenses.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 mt-4 pt-4">
              <span className="font-semibold text-slate-600">Expected Cash</span>
              <span className="font-bold text-emerald-600 text-lg">Rs. {data.expectedCash.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
              <span className="font-semibold text-slate-600">Counted Cash</span>
              <span className="font-bold text-slate-800">
                {data.countedCash !== undefined ? `Rs. ${data.countedCash.toLocaleString()}` : 'Not counted'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm pb-2">
              <span className="font-semibold text-slate-600">Variance</span>
              <span className={`font-bold ${data.variance !== undefined ? (data.variance < 0 ? 'text-rose-600' : data.variance > 0 ? 'text-amber-600' : 'text-emerald-600') : 'text-slate-500'}`}>
                {data.variance !== undefined ? `Rs. ${data.variance.toLocaleString()}` : 'Not counted'}
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
