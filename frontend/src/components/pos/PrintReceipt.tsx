import React from 'react';
import { POSConfigData } from '../../services/posConfig.service';

interface PrintReceiptProps {
  config: POSConfigData | null;
  sale: any; // Using any for simplicity here to accept sale details
}

export const PrintReceipt: React.FC<PrintReceiptProps> = ({ config, sale }) => {
  if (!sale || !config) return null;

  // Render optimized for 80mm printer (approx 72mm printable width)
  return (
    <div className="print-only text-black bg-white" style={{ width: '280px', padding: '0', margin: '0', fontSize: '12px', fontFamily: 'monospace' }}>
      <div className="text-center font-bold text-lg mb-2 border-b border-black pb-2 border-dashed">
        {config.shopName || 'GUJAR MILK SHOP'}
      </div>
      
      <div className="mb-4">
        <div>Bill No: {sale.id}</div>
        <div>Date: {new Date(sale.createdAt || new Date()).toLocaleDateString()}</div>
        <div>Time: {new Date(sale.createdAt || new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        {sale.customerName && <div>Customer: {sale.customerName}</div>}
      </div>

      <div className="border-t border-b border-dashed border-black py-2 mb-4">
        <div className="flex justify-between font-bold mb-1">
          <span className="w-1/2">ITEM</span>
          <span className="w-1/4 text-right">QTY</span>
          <span className="w-1/4 text-right">AMOUNT</span>
        </div>
        {sale.items?.map((item: any, i: number) => (
          <div key={i} className="flex justify-between mb-1">
            <span className="w-1/2 break-words capitalize">{item.itemName || item.name}</span>
            <span className="w-1/4 text-right">{item.quantity}</span>
            <span className="w-1/4 text-right">{item.lineTotal ?? item.totalPrice ?? item.total}</span>
          </div>
        ))}
      </div>

      <div className="mb-4 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{config.currencySymbol} {sale.subtotal}</span>
        </div>
        {sale.discount > 0 && (
          <div className="flex justify-between">
            <span>Discount</span>
            <span>{config.currencySymbol} {sale.discount}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm border-t border-dashed border-black pt-1 mt-1">
          <span>TOTAL</span>
          <span>{config.currencySymbol} {sale.totalAmount}</span>
        </div>
      </div>

      <div className="mb-4 space-y-1">
        <div className="flex justify-between">
          <span>Paid</span>
          <span>{config.currencySymbol} {sale.paidAmount}</span>
        </div>
        <div className="flex justify-between">
          <span>Remaining</span>
          <span>{config.currencySymbol} {sale.remainingBalance}</span>
        </div>
        <div className="mt-2">
          Payment: <span className="uppercase">{sale.paymentMethod || 'CASH'}</span>
        </div>
      </div>

      <div className="text-center mt-4 border-t border-dashed border-black pt-2 text-xs">
        {config.receiptFooterText || 'Thank you for your visit!'}
      </div>
    </div>
  );
};
