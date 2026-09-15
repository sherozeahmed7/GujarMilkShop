import React from 'react';
import { POSConfigData } from '../../services/posConfig.service';

export interface ReceiptItem {
  name?: string;
  itemName?: string;
  qty?: number;
  quantity?: number;
  price?: number;
  unitPrice?: number;
  total?: number;
  totalPrice?: number;
  lineTotal?: number;
}

export interface ReceiptSaleData {
  id?: number | string;
  tokenNumber?: number | string;
  shopName?: string;
  createdAt?: string | Date;
  customerName?: string | null;
  customerPhone?: string | null;
  items?: ReceiptItem[];
  totalAmount?: number;
  total?: number;
  subtotal?: number;
  discount?: number;
  discountAmount?: number;
  paidAmount?: number;
  remainingBalance?: number;
  paymentMethod?: string;
}

export interface ReceiptPreviewProps {
  config: POSConfigData | null;
  sale?: ReceiptSaleData | null;
  isPrintOnly?: boolean;
  showOuterContainer?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const CODE39_PATTERNS: Record<string, string> = {
  '0': '101001101101', '1': '110100101011', '2': '101100101011',
  '3': '110110010101', '4': '101001101011', '5': '110100110101',
  '6': '101100110101', '7': '101001011011', '8': '110100101101',
  '9': '101100101101', 'A': '110101001011', 'B': '101101001011',
  'C': '110110100101', 'D': '101011001011', 'E': '110101100101',
  'F': '101101100101', 'G': '101010011011', 'H': '110101001101',
  'I': '101101001101', 'J': '101011001101', 'K': '110101010011',
  'L': '101101010011', 'M': '110110101001', 'N': '101011010011',
  'O': '110101101001', 'P': '101101101001', 'Q': '101010110011',
  'R': '110101011001', 'S': '101101011001', 'T': '101011011001',
  'U': '110010101011', 'V': '100110101011', 'W': '110011010101',
  'X': '100101101011', 'Y': '110010110101', 'Z': '100110110101',
  '-': '100101011011', '.': '110010101101', ' ': '100110101101',
  '*': '100101101101', '$': '100100100101', '/': '100100101001',
  '+': '100101001001', '%': '101001001001'
};

export const BarcodeSvg: React.FC<{ text: string; height?: number }> = ({ text, height = 34 }) => {
  const clean = (text || 'BILL-28432').toUpperCase().replace(/[^A-Z0-9\-\.\ \$\/\+\%]/g, '');
  const encoded = `*${clean}*`;

  let binaryStr = '';
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded[i];
    const pattern = CODE39_PATTERNS[char] || CODE39_PATTERNS['-'];
    binaryStr += pattern + '0';
  }

  const barWidth = 1.6;
  const totalWidth = binaryStr.length * barWidth;

  const rects: React.ReactNode[] = [];
  for (let i = 0; i < binaryStr.length; i++) {
    if (binaryStr[i] === '1') {
      rects.push(
        <rect
          key={i}
          x={i * barWidth}
          y={0}
          width={barWidth}
          height={height}
          fill="#000000"
        />
      );
    }
  }

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${totalWidth} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      className="overflow-visible w-full"
      style={{ maxHeight: `${height}px` }}
    >
      {rects}
    </svg>
  );
};

function formatReceiptDate(dateInput?: string | Date): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(d.getTime())) return '03 Sept 2026 03:56 AM';
  const day = d.toLocaleDateString('en-GB', { day: '2-digit' });
  let month = d.toLocaleDateString('en-GB', { month: 'short' });
  if (month === 'Sep') month = 'Sept';
  const year = d.toLocaleDateString('en-GB', { year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${day} ${month} ${year} ${time}`;
}

export const ReceiptContent: React.FC<{
  config: POSConfigData | null;
  sale?: ReceiptSaleData | null;
  className?: string;
  style?: React.CSSProperties;
}> = ({ config, sale, className = '', style = {} }) => {
  const currency = config?.currencySymbol || 'Rs.';
  const shopName = (sale?.shopName || config?.shopName || 'GUJAR MILK SHOP').toUpperCase();

  // Dynamic vs Sample fallback data
  const isSample = !sale;
  const billId = sale?.id ?? 28432;
  const billNo = `BILL-${billId}`;
  
  const tokenNum = sale?.tokenNumber !== undefined && sale?.tokenNumber !== null ? Number(sale.tokenNumber) : 1;
  const tokenFormatted = tokenNum < 10 ? `0${tokenNum}` : `${tokenNum}`;

  const formattedDate = formatReceiptDate(sale?.createdAt);
  const paymentMethod = (sale?.paymentMethod || config?.defaultPaymentMethod || 'CASH').toUpperCase();

  const items: Array<{ name: string; qty: number; price: number; total: number }> = 
    sale?.items && sale.items.length > 0
      ? sale.items.map((i) => {
          const name = (i.itemName || i.name || 'ITEM').toUpperCase();
          const qty = Number(i.quantity ?? i.qty ?? 1);
          const price = Number(i.unitPrice ?? i.price ?? 0);
          const total = Number(i.totalPrice ?? i.lineTotal ?? i.total ?? (qty * price));
          return { name, qty, price, total };
        })
      : [
          { name: 'FRESH MILK', qty: 3.5, price: 240, total: 840 },
          { name: 'FRESH YOGURT', qty: 1, price: 270, total: 270 },
        ];

  const total = isSample ? 1110 : Number(sale?.totalAmount ?? sale?.total ?? items.reduce((acc, i) => acc + i.total, 0));
  const discount = Number(sale?.discountAmount ?? sale?.discount ?? 0);
  const receiptWidth = config?.receiptWidth === '80mm' ? '300px' : '280px';

  return (
    <div
      className={`bg-white p-4 text-black font-sans flex flex-col items-center select-none ${className}`}
      style={{
        width: receiptWidth,
        maxWidth: '100%',
        color: '#000000',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Header */}
      <div className="text-center w-full flex flex-col items-center">
        {config?.showLogoOnReceipt && (
          <img src="/logo.png" alt="Logo" className="w-14 h-14 object-contain mb-1.5" />
        )}
        <div className="font-black text-[17px] tracking-wide uppercase leading-tight text-black">
          {shopName}
        </div>
        <div className="font-bold text-[11px] text-slate-800 tracking-wider uppercase mt-0.5">
          SALE RECEIPT
        </div>
        <div className="font-black text-[34px] mt-0.5 tracking-tight leading-none text-black">
          TOKEN {tokenFormatted}
        </div>
      </div>

      {/* Bill & Date */}
      <div className="w-full flex justify-between items-center mt-2.5 font-bold text-[11px] text-black">
        <span>Bill: {billNo}</span>
        <span>{formattedDate}</span>
      </div>

      {/* Customer Name if present */}
      {sale?.customerName && (
        <div className="w-full flex justify-between items-center font-bold text-[10.5px] text-slate-800 mt-0.5">
          <span>Customer:</span>
          <span className="uppercase">{sale.customerName}</span>
        </div>
      )}

      {/* Paid Box with exact top & bottom solid divider lines */}
      <div className="w-full border-t-[1.5px] border-b-[1.5px] border-black mt-1.5 py-1 text-center font-extrabold text-[13px] tracking-[0.15em] text-black">
        PAID: {paymentMethod}
      </div>

      {/* Line Items */}
      <div className="w-full mt-2">
        {items.map((item, idx) => (
          <div key={idx} className="mb-2">
            <div className="flex justify-between font-black text-[13px] items-center text-black leading-tight">
              <span className="whitespace-nowrap uppercase">{item.name}</span>
              <span className="border-b-[1.5px] border-dotted border-black flex-grow mx-1.5 translate-y-[-2px]"></span>
              <span className="whitespace-nowrap font-black">{currency}{item.total}</span>
            </div>
            <div className="font-bold text-[11px] text-slate-800 mt-0.5">
              {item.qty} x {currency}{item.price}
            </div>
          </div>
        ))}
      </div>

      {/* Discount if present */}
      {discount > 0 && (
        <div className="w-full flex justify-between items-center font-bold text-[11px] text-slate-800 mb-1">
          <span>Discount</span>
          <span>-{currency}{discount}</span>
        </div>
      )}

      {/* Total */}
      <div className="w-full border-t-[1.5px] border-black mt-1 pt-1.5 flex justify-between items-center font-black text-[22px] leading-none text-black">
        <span>TOTAL</span>
        <span>{currency}{total}</span>
      </div>

      {/* Barcode & Footer */}
      <div className="w-full mt-2.5 flex flex-col items-center">
        <div className="w-full flex justify-center py-0.5">
          <BarcodeSvg text={billNo} height={32} />
        </div>
        <div className="font-bold text-[9px] mt-1 tracking-[0.12em] uppercase text-black text-center">
          SCAN FOR RETURN / AUDIT
        </div>
        <div className="font-bold text-[12px] mt-2 text-center whitespace-pre-wrap text-black leading-snug">
          {config?.receiptFooterText || 'Thank you for your visit!'}
        </div>
      </div>
    </div>
  );
};

export const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({
  config,
  sale,
  isPrintOnly = false,
  showOuterContainer = true,
  className = '',
  style = {},
}) => {
  if (isPrintOnly) {
    return (
      <div className="print-only bg-white">
        <ReceiptContent config={config} sale={sale} className={className} style={style} />
      </div>
    );
  }

  if (!showOuterContainer) {
    return (
      <div className="shadow-md rounded-sm overflow-hidden border border-slate-200">
        <ReceiptContent config={config} sale={sale} className={className} style={style} />
      </div>
    );
  }

  return (
    <div className="bg-slate-100 p-6 rounded-2xl border border-slate-200 flex justify-center sticky top-6">
      <div className="shadow-md rounded-sm overflow-hidden border border-slate-200 bg-white">
        <ReceiptContent config={config} sale={sale} className={className} style={style} />
      </div>
    </div>
  );
};
