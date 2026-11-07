import React, { useState } from 'react';
import { X, Printer, CheckCircle } from 'lucide-react';
import { KhataReceiptData, printKhataReceipt } from '../../utils/khataReceiptPrinter';
import { POSConfigData } from '../../services/posConfig.service';

interface KhataReceiptModalProps {
  receipt: KhataReceiptData;
  posConfig: POSConfigData | null;
  onClose: () => void;
}

export const KhataReceiptModal: React.FC<KhataReceiptModalProps> = ({
  receipt,
  posConfig,
  onClose,
}) => {
  const [printing, setPrinting] = useState(false);
  const [printSuccess, setPrintSuccess] = useState(false);

  const currency = posConfig?.currencySymbol || 'Rs.';
  const shopName = (posConfig?.shopName || 'GUJAR MILK SHOP').toUpperCase();

  const handlePrint = async () => {
    setPrinting(true);
    try {
      await printKhataReceipt(receipt);
    } catch (err) {
      console.error('Failed to print receipt:', err);
    } finally {
      setPrinting(false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col border border-slate-200 dark:border-[#2d4a35]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35] bg-slate-50/70 dark:bg-[#142119]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-[#166534] dark:text-[#22c55e]">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-sm">Payment Receipt</h3>
              <p className="text-[11px] text-slate-500 dark:text-[#64916e]">{receipt.customerName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-[#e2f5e8] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Paper Receipt Preview matching POS Receipt */}
        <div className="p-4 bg-slate-100 dark:bg-[#142119] flex justify-center">
          <div className="bg-white text-black p-5 rounded-lg shadow-sm border border-slate-200 w-full max-w-[280px] font-sans text-xs select-none">
            {/* Header */}
            <div className="text-center">
              <div className="font-black text-base uppercase tracking-wide">{shopName}</div>
              <div className="font-bold text-[10px] text-slate-700 tracking-wider uppercase mt-0.5">KHATA PAYMENT SLIP</div>
              {receipt.receiptNo && (
                <div className="font-black text-lg mt-1 tracking-tight">RECEIPT #{receipt.receiptNo}</div>
              )}
            </div>

            {/* Meta */}
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 mt-2">
              <span>Date:</span>
              <span>
                {receipt.date
                  ? new Date(receipt.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                  : new Date().toLocaleDateString('en-GB')}
              </span>
            </div>

            <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 mt-0.5">
              <span>Customer:</span>
              <span className="uppercase truncate max-w-[150px]">{receipt.customerName}</span>
            </div>

            {receipt.customerPhone && (
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 mt-0.5">
                <span>Phone:</span>
                <span>{receipt.customerPhone}</span>
              </div>
            )}

            {/* Payment Method Banner */}
            <div className="border-t-[1.5px] border-b-[1.5px] border-black my-2 py-1 text-center font-extrabold text-xs tracking-wider uppercase">
              PAID: {receipt.paymentMethod || 'CASH'}
            </div>

            {/* Balances */}
            <div className="space-y-1.5 py-1">
              <div className="flex justify-between font-bold text-slate-800">
                <span>Previous Balance</span>
                <span>{currency} {Math.round(receipt.previousBalance).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-black text-slate-900">
                <span>Amount Paid</span>
                <span>{currency} {Math.round(receipt.paidAmount).toLocaleString()}</span>
              </div>
              {receipt.discountAmount && receipt.discountAmount > 0 ? (
                <div className="flex justify-between font-semibold text-slate-600">
                  <span>Discount</span>
                  <span>-{currency} {Math.round(receipt.discountAmount).toLocaleString()}</span>
                </div>
              ) : null}
            </div>

            {/* Remaining Balance */}
            <div className="border-t-[1.5px] border-black mt-2 pt-1.5 flex justify-between items-center font-black text-base text-black">
              <span>REMAINING</span>
              <span>{currency} {Math.round(receipt.remainingBalance).toLocaleString()}</span>
            </div>

            {/* Footer */}
            <div className="mt-3 pt-2 border-t border-dotted border-slate-300 text-center text-[10px] text-slate-600">
              {posConfig?.receiptFooterText || 'Thank you for your business!'}
            </div>
          </div>
        </div>

        {printSuccess && (
          <div className="mx-4 mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-[#166534] flex items-center justify-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Sent to printer
          </div>
        )}

        {/* Action Buttons: Cancel and Print */}
        <div className="p-4 border-t border-slate-100 dark:border-[#2d4a35] flex gap-3 bg-white dark:bg-[#1a2e1f]">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-[#1a2e1f] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={printing}
            className="flex-1 py-2.5 bg-[#166534] hover:bg-[#14532d] active:bg-[#0f3d21] text-white rounded-xl font-bold text-sm transition-all shadow-md shadow-[#166534]/25 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            {printing ? 'Printing…' : 'Print Receipt'}
          </button>
        </div>
      </div>
    </div>
  );
};

