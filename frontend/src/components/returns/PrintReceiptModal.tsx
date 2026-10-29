import React, { useEffect } from 'react';
import { X, Printer } from 'lucide-react';
import { ReturnRecord, ReturnType } from '../../types';
import { BrandLogo } from '../BrandLogo';
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

interface PrintReceiptModalProps {
  record: ReturnRecord;
  onClose: () => void;
}


import { posConfigService } from '../../services/posConfig.service';

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({ record, onClose }) => {
  const [isPrinting, setIsPrinting] = React.useState(false);

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      if (typeof window !== 'undefined' && ((window as any).__TAURI_INTERNALS__ || (window as any).__TAURI__)) {
        const { invoke } = await import('@tauri-apps/api/core');
        const posConfig = await posConfigService.getPOSConfig().catch(() => null);

        const ESC = 0x1b;
        const GS = 0x1d;
        const LF = 0x0a;
        const bytes: number[] = [
          ESC, 0x40, // INIT
          ESC, 0x61, 0x01, // Center
          ESC, 0x45, 0x01, // Bold ON
          ...Array.from(new TextEncoder().encode('GUJAR MILK SHOP\nRETURN / REFUND RECEIPT\n')),
          ESC, 0x45, 0x00, // Bold OFF
          ...Array.from(new TextEncoder().encode(`Return ID: ${record.returnId}\nBill No: ${formatInvoiceNumber(record.billNumber)}\nDate: ${formatDate(record.date)}\nCustomer: ${record.customer}\nPayment: ${record.paymentMethod}\n`)),
          ...Array.from(new TextEncoder().encode('--------------------------------\n')),
          ESC, 0x61, 0x00, // Left
        ];

        for (const item of record.items) {
          bytes.push(...Array.from(new TextEncoder().encode(`${item.name} x ${item.returnQty}\n  Refund: Rs. ${item.refundAmount}\n`)));
        }

        bytes.push(
          ...Array.from(new TextEncoder().encode('--------------------------------\n')),
          ESC, 0x45, 0x01, // Bold ON
          ...Array.from(new TextEncoder().encode(`REFUND TOTAL: Rs. ${record.refundAmount}\n`)),
          ESC, 0x45, 0x00, // Bold OFF
          ESC, 0x61, 0x01, // Center
          LF, // Minimal 0.2 cm feed before cut
          GS, 0x56, 0x00 // Standard ESC/POS full cut (fires blade once)
        );

        await invoke('print_raw_bytes', {
          printerName: posConfig?.printerName || '',
          data: bytes,
        });
        return;
      }
    } catch (e) {
      console.warn('Tauri raw print error, falling back to window.print():', e);
    } finally {
      setIsPrinting(false);
    }

    window.print();
  };

  // Inject print styles
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-receipt-style';
    style.innerHTML = `
      @media print {
        body > * { display: none !important; }
        #print-receipt-content { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('print-receipt-style');
      if (el) el.remove();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-800">Print Return Receipt</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Preview */}
        <div id="print-receipt-content" className="flex-1 overflow-y-auto custom-scrollbar p-5">
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 font-mono text-sm space-y-3">
            {/* Shop name */}
            <div className="text-center flex flex-col items-center space-y-0.5">
              <BrandLogo variant="receipt" />
              <p className="font-bold text-base text-slate-800">GUJJAR MILK SHOP</p>
              <p className="text-xs text-slate-500">Return / Refund Receipt</p>
              <p className="text-xs text-slate-400">━━━━━━━━━━━━━━━━━━━━━━━</p>
            </div>

            {/* Meta */}
            <div className="space-y-1 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Return ID:</span>
                <span className="font-bold">{record.returnId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bill No:</span>
                <span className="font-bold font-mono">{formatInvoiceNumber(record.billNumber)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span>{formatDate(record.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer:</span>
                <span>{record.customer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment:</span>
                <span>{record.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Type:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${returnTypeColors[record.returnType]}`}>
                  {record.returnType}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400">━━━━━━━━━━━━━━━━━━━━━━━</p>

            {/* Items */}
            <div className="space-y-1.5">
              {record.items.map((item) => (
                <div key={item.itemId} className="text-xs">
                  <div className="flex justify-between font-medium text-slate-800">
                    <span>{item.name}</span>
                    <span>Rs. {item.refundAmount.toLocaleString()}</span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    {item.returnQty} × Rs. {formatReceiptUnitPrice(item.unitPrice)}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-400">━━━━━━━━━━━━━━━━━━━━━━━</p>

            {/* Total */}
            <div className="flex justify-between font-bold text-base text-emerald-700">
              <span>REFUND TOTAL</span>
              <span>Rs. {record.refundAmount.toLocaleString()}</span>
            </div>

            {/* Reason */}
            {record.reason && (
              <>
                <p className="text-xs text-slate-400">━━━━━━━━━━━━━━━━━━━━━━━</p>
                <div>
                  <p className="text-[11px] text-slate-500 font-bold">Reason:</p>
                  <p className="text-xs text-slate-700">{record.reason}</p>
                </div>
              </>
            )}

            <p className="text-xs text-slate-400">━━━━━━━━━━━━━━━━━━━━━━━</p>
            <div className="text-center text-[11px] text-slate-400 space-y-0.5">
              <p>Processed by: {record.processedBy}</p>
              <p>Status: {record.status}</p>
              <p className="text-slate-300">— Thank you —</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold rounded-xl transition-all"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all"
          >
            <Printer className="w-4 h-4" />
            {isPrinting ? 'Printing...' : 'Print'}
          </button>
        </div>
      </div>
    </div>
  );
};
