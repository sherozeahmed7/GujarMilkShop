export type RegisterStatus = 'OPEN' | 'COUNTED' | 'CLOSED';
export type DifferenceStatus = 'Balanced' | 'Short' | 'Over';

export interface RegisterData {
  id: string;
  date: string; // ISO Date string for the shop day
  
  cashier: string;
  shiftOpen: string; // ISO Timestamp
  shiftClose?: string; // ISO Timestamp
  
  billsCount: number;
  
  // Sales Breakdown
  grossSales: number;
  discounts: number;
  refunds: number;
  voids: number;
  
  // Payment Methods
  cashSales: number;
  onlineSales: number;
  khataSales: number;
  
  // Cash Drawer
  openingBalance: number;
  expenses: number;
  expectedCash: number;
  countedCash?: number;
  
  // Closing
  variance?: number;
  differenceStatus?: DifferenceStatus;
  status: RegisterStatus;
  notes?: string;
}
