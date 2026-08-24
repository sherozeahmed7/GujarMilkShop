/**
 * Types for Customer Monthly Milk Report
 * Replace service implementations to connect real backend — no UI changes needed.
 */

export interface DailyMilkEntry {
  date: number; // Day of month (1–31)
  quantityKg: number;
  ratePerKg: number;
  amount: number; // quantityKg * ratePerKg
}

export interface CustomerPayment {
  id: string;
  date: string; // ISO string
  amount: number;
  method: 'Cash' | 'Online' | 'Bank Transfer';
  notes: string;
  receivedBy: string;
}

export interface MonthlyStatement {
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  milkRatePerKg: number;
  month: number; // 0-indexed (0 = January)
  year: number;
  dailyEntries: DailyMilkEntry[]; // one entry per day of the month
  previousBalance: number; // carry-forward from previous month
  payments: CustomerPayment[];
}

export interface CalculatedStatement {
  totalMilkKg: number;
  totalMilkAmount: number;
  totalPayable: number; // previousBalance + totalMilkAmount
  totalReceived: number;
  remaining: number; // totalPayable - totalReceived
}

export interface AddPaymentPayload {
  customerId: number;
  month: number;
  year: number;
  amount: number;
  method: 'Cash' | 'Online' | 'Bank Transfer';
  notes: string;
  date: string;
}
