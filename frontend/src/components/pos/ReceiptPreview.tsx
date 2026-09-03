import React from 'react';
import { POSConfigData } from '../../services/posConfig.service';

interface ReceiptPreviewProps {
  config: POSConfigData;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ config }) => {
  const currentDate = new Date();
  const dateStr = currentDate.toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = currentDate.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit', hour12: true });

  const dummyItems = [
    { name: 'Fresh Milk', qty: 2.5, price: 160, total: 400 },
    { name: 'Yogurt', qty: 1, price: 120, total: 120 },
  ];
  
  const subtotal = 520;
  const discount = config.allowDiscount ? 20 : 0;
  const total = subtotal - discount;

  return (
    <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200 flex justify-center sticky top-6">
      <div 
        className="bg-white shadow-md p-4 text-slate-800 font-mono text-sm leading-tight flex flex-col items-center overflow-hidden relative"
        style={{ width: config.receiptWidth === '80mm' ? '320px' : '230px', minHeight: '400px' }}
      >
        {/* Zig-zag top border for thermal paper look */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-slate-100" style={{ clipPath: 'polygon(0% 0%, 5% 100%, 10% 0%, 15% 100%, 20% 0%, 25% 100%, 30% 0%, 35% 100%, 40% 0%, 45% 100%, 50% 0%, 55% 100%, 60% 0%, 65% 100%, 70% 0%, 75% 100%, 80% 0%, 85% 100%, 90% 0%, 95% 100%, 100% 0%)' }}></div>

        <div className="mt-4 mb-2 text-center w-full">
          <h2 className="font-bold text-xl uppercase tracking-wide truncate">{config.shopName || 'Shop Name'}</h2>
          <h3 className="font-bold text-lg mt-1">Token: 1042</h3>
          <div className="font-bold mt-2 border-y border-dashed border-slate-400 py-1">RECEIPT</div>
        </div>

        <div className="w-full text-xs space-y-1 mb-2">
          <div className="flex justify-between"><span>Bill#: 1042</span><span>{dateStr}</span></div>
          <div className="flex justify-between"><span>Time:</span><span>{timeStr}</span></div>
          {config.requireCustomerName && <div className="flex justify-between"><span>Customer:</span><span>Walk-in</span></div>}
        </div>

        <div className="w-full border-t border-dashed border-slate-400 pt-1 mb-1">
          <div className="flex justify-between font-bold text-xs pb-1 border-b border-dashed border-slate-400">
            <span className="w-1/2">Item</span>
            <span className="w-1/6 text-right">Qty</span>
            <span className="w-1/4 text-right">Total</span>
          </div>
          {dummyItems.map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs py-1">
              <span className="w-1/2 truncate pr-1">{item.name}</span>
              <span className="w-1/6 text-right">{item.qty}</span>
              <span className="w-1/4 text-right">{item.total.toFixed(2)}</span>
            </div>
          ))}
        </div>

        <div className="w-full border-t border-dashed border-slate-400 pt-1 text-xs space-y-1">
          <div className="flex justify-between"><span>Subtotal:</span><span>Rs {subtotal.toFixed(2)}</span></div>
          {discount > 0 && <div className="flex justify-between"><span>Discount:</span><span>Rs {discount.toFixed(2)}</span></div>}
          <div className="flex justify-between font-bold text-sm pt-1 border-t border-dashed border-slate-400">
            <span>TOTAL:</span><span>Rs {total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between pt-1"><span>Paid:</span><span>Rs {total.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Method:</span><span>{config.defaultPaymentMethod.toUpperCase()}</span></div>
        </div>

        <div className="mt-4 pt-2 border-t border-dashed border-slate-400 w-full text-center text-xs whitespace-pre-wrap">
          {config.receiptFooterText || 'Thank you for your visit!'}
        </div>

        {/* Zig-zag bottom border */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-slate-100" style={{ clipPath: 'polygon(0% 100%, 5% 0%, 10% 100%, 15% 0%, 20% 100%, 25% 0%, 30% 100%, 35% 0%, 40% 100%, 45% 0%, 50% 100%, 55% 0%, 60% 100%, 65% 0%, 70% 100%, 75% 0%, 80% 100%, 85% 0%, 90% 100%, 95% 0%, 100% 100%)' }}></div>
      </div>
    </div>
  );
};
