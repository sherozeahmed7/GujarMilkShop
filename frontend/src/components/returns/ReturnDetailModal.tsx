import React from 'react';
import { X, ReceiptText, User, Calendar, CreditCard, Package, Printer } from 'lucide-react';
import { ReturnRecord, ReturnType } from '../../types';
import { formatReceiptUnitPrice } from '../../utils/escposRasterizer';

const returnTypeColors: Record<ReturnType, string> = {
  'Full Return': 'bg-rose-100 text-rose-700',
  'Partial Return': 'bg-amber-100 text-amber-700',
  'Correction': 'bg-blue-100 text-blue-700',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatInvoiceNumber(raw: string | number) {
  const n = Number(String(raw).replace(/^(INV-0*|BILL-0*|#)/i, ''));
  if (isNaN(n) || n <= 0) return String(raw);
  return `INV-${String(n).padStart(5, '0')}`;
}

interface ReturnDetailModalProps {
  record: ReturnRecord;
  onClose: () => void;
  onPrint: () => void;
}

export const ReturnDetailModal: React.FC<ReturnDetailModalProps> = ({ record, onClose, onPrint }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0">
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-[#64916e] uppercase tracking-wider">Return Details</p>
            <h2 className="text-base font-bold text-slate-800 dark:text-[#e2f5e8] mt-0.5">{record.returnId}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-[#142119] rounded-xl p-3 border border-slate-100 dark:border-[#2d4a35]">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-[#64916e] mb-1">
                <ReceiptText className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Invoice / Bill Number</span>
              </div>
              <p className="text-sm font-bold text-blue-700 font-mono">{formatInvoiceNumber(record.billNumber)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-[#142119] rounded-xl p-3 border border-slate-100 dark:border-[#2d4a35]">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-[#64916e] mb-1">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Return Date</span>
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{formatDate(record.date)}</p>
            </div>
            <div className="bg-slate-50 dark:bg-[#142119] rounded-xl p-3 border border-slate-100 dark:border-[#2d4a35]">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-[#64916e] mb-1">
                <User className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Customer</span>
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{record.customer}</p>
            </div>
            <div className="bg-slate-50 dark:bg-[#142119] rounded-xl p-3 border border-slate-100 dark:border-[#2d4a35]">
              <div className="flex items-center gap-1.5 text-slate-400 dark:text-[#64916e] mb-1">
                <CreditCard className="w-3.5 h-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-wider">Payment Method</span>
              </div>
              <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{record.paymentMethod}</p>
            </div>
          </div>

          {/* Return type + status */}
          <div className="flex gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${returnTypeColors[record.returnType]}`}>
              {record.returnType}
            </span>
            <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700">
              {record.status}
            </span>
          </div>

          {/* Reason */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4">
            <p className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">Reason</p>
            <p className="text-sm text-amber-800 dark:text-amber-300">{record.reason}</p>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Package className="w-3.5 h-3.5 text-slate-400 dark:text-[#64916e]" />
              <p className="text-[11px] font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Returned Items</p>
            </div>
            <div className="border border-slate-200 dark:border-[#2d4a35] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-[#142119]">
                  <tr>
                    <th className="text-left px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-[#8ba895] uppercase">Item</th>
                    <th className="text-right px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-[#8ba895] uppercase">Qty</th>
                    <th className="text-right px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-[#8ba895] uppercase">Unit</th>
                    <th className="text-right px-3 py-2 text-[11px] font-bold text-slate-500 dark:text-[#8ba895] uppercase">Refund</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {record.items.map((item) => (
                    <tr key={item.itemId} className="bg-white dark:bg-[#1a2e1f]">
                      <td className="px-3 py-2.5 font-medium text-slate-800 dark:text-[#e2f5e8]">{item.name}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-[#a7c4ae]">{item.returnQty}</td>
                      <td className="px-3 py-2.5 text-right text-slate-600 dark:text-[#a7c4ae]">Rs. {formatReceiptUnitPrice(item.unitPrice)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700">Rs. {item.refundAmount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Refund Total */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-xl px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Total Refunded</p>
              <p className="text-2xl font-bold text-emerald-700 mt-0.5">Rs. {record.refundAmount.toLocaleString()}</p>
            </div>
            <p className="text-xs text-emerald-600">Processed by {record.processedBy}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-[#2d4a35] flex gap-3 flex-shrink-0">
          <button
            onClick={onPrint}
            className="flex items-center gap-2 px-5 py-2.5 border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] hover:bg-slate-50 dark:hover:bg-[#1e3124] text-slate-700 dark:text-[#a7c4ae] text-sm font-semibold rounded-xl transition-all"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
