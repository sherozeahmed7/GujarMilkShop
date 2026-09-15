import React from 'react';
import { POSConfigData } from '../../services/posConfig.service';
import { ReceiptContent, ReceiptSaleData } from './ReceiptPreview';

interface PrintReceiptProps {
  config: POSConfigData | null;
  sale: ReceiptSaleData | any;
  className?: string;
  style?: React.CSSProperties;
}

export const PrintReceipt: React.FC<PrintReceiptProps> = ({ config, sale, className = '', style = {} }) => {
  if (!sale || !config) return null;

  return (
    <div className={`print-only bg-white ${className}`} style={{ margin: 0, padding: 0, ...style }}>
      <ReceiptContent config={config} sale={sale} />
    </div>
  );
};

export default PrintReceipt;
