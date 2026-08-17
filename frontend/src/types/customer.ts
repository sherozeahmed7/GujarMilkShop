export interface Customer {
  id: string;
  name: string;
  phone: string;
  cardNumber: string;
  address: string;
  notes: string;
  balance: number; // outstanding balance
  lastSaleDate: string | null;
}

export type KhataTransactionType = 'Opening Balance' | 'Credit Sale' | 'Payment';

export interface KhataTransaction {
  id: string;
  customerId: string;
  date: string;
  type: KhataTransactionType;
  amount: number;
  description: string;
  method?: string; // e.g. Cash, Online for Payment
}
