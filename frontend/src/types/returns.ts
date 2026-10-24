export interface BillItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  returnableQty?: number;
  unitPrice: number;
  lineTotal: number;
}

export interface MockBill {
  billNumber: string;
  date: string; // ISO string
  customer: string;
  paymentMethod: 'Cash' | 'Card' | 'Khata' | 'Bank Transfer';
  items: BillItem[];
  total: number;
  cashier: string;
}

export type ReturnType = 'Full Return' | 'Partial Return' | 'Correction';
export type ReturnStatus = 'Completed' | 'Pending' | 'Cancelled';

export interface ReturnItem {
  itemId: string;
  name: string;
  returnQty: number;
  unitPrice: number;
  refundAmount: number;
}

export interface ReturnRecord {
  returnId: string;
  billNumber: string;
  date: string; // ISO string
  customer: string;
  returnType: ReturnType;
  refundAmount: number;
  paymentMethod: 'Cash' | 'Card' | 'Khata' | 'Bank Transfer';
  reason: string;
  status: ReturnStatus;
  items: ReturnItem[];
  processedBy: string;
}
