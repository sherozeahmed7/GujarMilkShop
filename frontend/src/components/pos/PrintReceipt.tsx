import React from 'react';
import { POSConfigData } from '../../services/posConfig.service';

interface PrintReceiptProps {
  config: POSConfigData | null;
  sale: any; // Using any for simplicity here to accept sale details
}

export const PrintReceipt: React.FC<PrintReceiptProps> = ({ config, sale }) => {
  if (!sale || !config) return null;

  const currency = config.currencySymbol || 'Rs.';
  const shopName = (config.shopName || 'GUJAR MILK SHOP').toUpperCase();
  const tokenFormatted = sale.tokenNumber ? (sale.tokenNumber < 10 ? `0${sale.tokenNumber}` : `${sale.tokenNumber}`) : '01';

  return (
    <div className="print-only text-black bg-white" style={{ width: config.receiptWidth === '80mm' ? '300px' : '260px', padding: '0', margin: '0', fontSize: '11px', fontFamily: 'monospace' }}>
      <div className="text-center w-full mb-2">
        <div className="font-extrabold text-base uppercase">{shopName}</div>
        <div className="font-bold text-xs tracking-wider">SALE RECEIPT</div>
        <div className="font-extrabold text-2xl mt-1">TOKEN {tokenFormatted}</div>
      </div>
      
      <div className="flex justify-between font-bold text-[10px] mb-2">
        <span>Bill: BILL-{sale.id}</span>
        <span>{new Date(sale.createdAt || new Date()).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })} {new Date(sale.createdAt || new Date()).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      {sale.customerName && <div className="font-bold text-[10px] mb-1">Customer: {sale.customerName}</div>}

      <div className="w-full border-t border-b border-black py-1 text-center font-bold text-xs tracking-widest my-1">
        PAID: {(sale.paymentMethod || 'CASH').toUpperCase()}
      </div>

      <div className="my-2">
        {sale.items?.map((item: any, i: number) => (
          <div key={i} className="mb-1">
            <div className="flex justify-between font-bold text-xs">
              <span className="uppercase">{item.itemName || item.name}</span>
              <span className="border-b border-dotted border-black flex-grow mx-1 translate-y-[-3px]"></span>
              <span>{currency}{item.lineTotal ?? item.totalPrice ?? item.total}</span>
            </div>
            <div className="text-[10px] pl-2 text-gray-700">
              {item.quantity} x {currency}{item.unitPrice ?? item.price}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-black pt-1 mb-2 space-y-1">
        {sale.discount > 0 && (
          <div className="flex justify-between font-medium">
            <span>Discount</span>
            <span>{currency}{sale.discount}</span>
          </div>
        )}
        <div className="flex justify-between font-extrabold text-sm border-t border-black pt-1">
          <span>TOTAL</span>
          <span>{currency}{sale.totalAmount}</span>
        </div>
      </div>

      <div className="border-t border-black pt-1 mb-2 space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Paid</span>
          <span>{currency}{sale.paidAmount}</span>
        </div>
        {sale.remainingBalance > 0 ? (
          <div className="flex justify-between font-bold">
            <span>Balance Due</span>
            <span>{currency}{sale.remainingBalance}</span>
          </div>
        ) : sale.remainingBalance < 0 ? (
          <div className="flex justify-between">
            <span>Change</span>
            <span>{currency}{Math.abs(sale.remainingBalance)}</span>
          </div>
        ) : null}
      </div>

      <div className="text-center mt-3 border-t border-black pt-2 text-[10px]">
        <div className="font-bold tracking-wider mb-1">SCAN FOR RETURN / AUDIT</div>
        <div className="whitespace-pre-wrap">{config.receiptFooterText || 'Thank you for your visit!'}</div>
      </div>
    </div>
  );
};

