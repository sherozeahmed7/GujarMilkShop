import React from 'react';
import { X, Calendar } from 'lucide-react';
import { RegisterData } from '../../types';

interface ZReportDetailModalProps {
  record: RegisterData;
  onClose: () => void;
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

export const ZReportDetailModal: React.FC<ZReportDetailModalProps> = ({ record, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl border border-slate-200 dark:border-[#2d4a35] w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Decorative gradient */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-emerald-400 to-emerald-500"></div>
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Z-Report Details</p>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-emerald-500" />
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{record.date}</h2>
              <span className="px-3 py-1 rounded text-xs font-bold bg-slate-100 text-slate-600 ml-2 border border-slate-200">
                {record.id}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-6">
          
            {/* Left Column */}
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Cashier</span>
                <span className="font-bold text-slate-800">{record.cashier}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Shift Open</span>
                <span className="font-bold text-slate-800">{formatTime(record.shiftOpen)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Shift Close</span>
                <span className="font-bold text-slate-800">{formatTime(record.shiftClose)}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Total Hours Open</span>
                <span className="font-bold text-slate-800">
                  {record.shiftClose ? calculateHours(record.shiftOpen, record.shiftClose) : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Bills Count</span>
                <span className="font-bold text-slate-800">{record.billsCount}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Gross Sales</span>
                <span className="font-bold text-slate-800">Rs. {record.grossSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Discounts</span>
                <span className="font-bold text-rose-600">- Rs. {record.discounts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Refunds</span>
                <span className="font-bold text-rose-600">- Rs. {record.refunds.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Voids</span>
                <span className="font-bold text-slate-800">{record.voids} bills</span>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Opening Cash</span>
                <span className="font-bold text-slate-800">Rs. {record.openingBalance.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Cash Sales</span>
                <span className="font-bold text-emerald-600">Rs. {record.cashSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Online Sales</span>
                <span className="font-bold text-slate-800">Rs. {record.onlineSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Khata / Credit Sales</span>
                <span className="font-bold text-slate-800">Rs. {record.khataSales.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-500">Expenses</span>
                <span className="font-bold text-rose-600">- Rs. {record.expenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2 mt-4 pt-4">
                <span className="font-semibold text-slate-600">Expected Cash</span>
                <span className="font-bold text-emerald-600 text-lg">Rs. {record.expectedCash.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="font-semibold text-slate-600">Counted Cash</span>
                <span className="font-bold text-slate-800">
                  {record.countedCash !== undefined ? `Rs. ${record.countedCash.toLocaleString()}` : 'Not counted'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm pb-2">
                <span className="font-semibold text-slate-600">Variance</span>
                <span className={`font-bold ${record.variance !== undefined ? (record.variance < 0 ? 'text-rose-600' : record.variance > 0 ? 'text-amber-600' : 'text-emerald-600') : 'text-slate-500'}`}>
                  {record.variance !== undefined ? `Rs. ${record.variance.toLocaleString()}` : 'Not counted'}
                </span>
              </div>
            </div>

          </div>
          
          {record.notes && (
            <div className="mt-8 pt-6 border-t border-slate-100">
               <span className="font-semibold text-slate-500 text-sm block mb-2">Notes</span>
               <p className="text-slate-700 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">{record.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
