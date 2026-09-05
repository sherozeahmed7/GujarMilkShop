import React from 'react';
import { POSConfigData } from '../../services/posConfig.service';

interface ReceiptPreviewProps {
  config: POSConfigData;
}

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ config }) => {
  const currency = config.currencySymbol || 'Rs.';
  const shopName = (config.shopName || 'GUJAR MILK SHOP').toUpperCase();

  const dummyItems = [
    { name: 'FRESH MILK', qty: 3.5, price: 240, total: 840 },
    { name: 'FRESH YOGURT', qty: 1, price: 270, total: 270 },
  ];
  
  const total = 1110;

  return (
    <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200 flex justify-center sticky top-6">
      <div 
        className="bg-white p-4 text-black font-sans text-xs flex flex-col items-center overflow-hidden relative shadow-md"
        style={{ width: config.receiptWidth === '80mm' ? '320px' : '280px', minHeight: '400px', fontWeight: 600 }}
      >
        <div className="text-center w-full mt-2 flex flex-col items-center">
          {config.showLogoOnReceipt && (
            <img src="/logo.png" alt="Logo" className="w-16 h-16 object-contain mb-2" />
          )}
          <div className="font-extrabold text-base tracking-wide uppercase">{shopName}</div>
          <div className="font-bold text-xs text-slate-700 tracking-wider">SALE RECEIPT</div>
          <div className="font-extrabold text-3xl mt-1 tracking-tight">TOKEN 01</div>
        </div>

        <div className="w-full flex justify-between mt-2 font-bold text-[11px]">
          <span>Bill: BILL-28432</span>
          <span>03 Sept 2026 03:56 AM</span>
        </div>

        <div className="w-full border-t-[1.5px] border-black mt-1 py-1 text-center font-bold text-sm tracking-widest">
          PAID: {(config.defaultPaymentMethod || 'CASH').toUpperCase()}
        </div>
        <div className="w-full border-t-[1.5px] border-black mb-1"></div>

        <div className="w-full mt-1">
          {dummyItems.map((item, idx) => (
            <div key={idx} className="mb-1">
              <div className="flex justify-between font-extrabold text-sm items-center">
                <span className="whitespace-nowrap">{item.name}</span>
                <span className="border-b-[2px] border-dotted border-black flex-grow mx-1 translate-y-[-4px]"></span>
                <span className="whitespace-nowrap">{currency}{item.total}</span>
              </div>
              <div className="font-bold text-[11px] text-slate-700">
                {item.qty} x {currency}{item.price}
              </div>
            </div>
          ))}
        </div>

        <div className="w-full border-t-[1.5px] border-black mt-1 pt-1 flex justify-between font-extrabold text-xl items-center">
          <span>TOTAL</span>
          <span>{currency}{total}</span>
        </div>

        <div className="w-full mt-2 flex flex-col items-center">
          {/* Mock Barcode */}
          <div className="w-full h-8 bg-black flex justify-between items-center px-1" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #000 0, #000 3px, #fff 3px, #fff 5px, #000 5px, #000 6px, #fff 6px, #fff 9px)'}}>
             {/* Use repeating linear gradient to simulate barcode lines */}
          </div>
          <div className="font-bold text-[9px] mt-1 tracking-wider uppercase">
            SCAN FOR RETURN / AUDIT
          </div>
          <div className="font-bold text-xs mt-2 text-center whitespace-pre-wrap">
            {config.receiptFooterText || 'Thank you for your visit!'}
          </div>
        </div>
      </div>
    </div>
  );
};
