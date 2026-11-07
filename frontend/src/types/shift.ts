export type ShiftStatus = 'Open' | 'Closed';

export type ShiftDifferenceStatus = 'Balanced' | 'Short' | 'Over';

export interface ShiftRecord {
  id: string;
  date: string;
  
  openedById?: number;
  openedBy: string;
  openedAt: string;
  openingCash: number;
  openingNotes?: string;

  closedById?: number;
  closedBy?: string;
  closedAt?: string;
  
  expectedCash: number;
  countedCash?: number;
  difference?: number;
  differenceStatus?: ShiftDifferenceStatus;
  closingNotes?: string;
  isAutoClosed?: boolean;

  status: ShiftStatus;

  // Sales aggregates (populated by backend from real sales in the shift window)
  billsCount:  number;
  grossSales:  number;
  cashSales:   number;
  onlineSales: number;
  khataSales:  number;
}

export interface ShiftLedgerItem {
  id: string;
  timestamp: string;
  rawTime: number;
  flowType: 'CASH_IN' | 'CASH_OUT';
  category: string;
  description: string;
  party: string;
  cashIn: number;
  cashOut: number;
  referenceId?: string;
  runningBalance: number;
}

export interface ShiftLedgerSummary {
  openingCash: number;
  walkInCashSales: number;
  customerKhataPayments: number;
  totalCashIn: number;
  supplierCashOut: number;
  expenseCashOut: number;
  totalCashOut: number;
  expectedCash: number;
  countedCash?: number;
  difference?: number;
  differenceStatus?: ShiftDifferenceStatus;
  isBalanced: boolean;
}

export interface ShiftLedgerResponse {
  shiftId: number;
  shiftDate: string;
  status: ShiftStatus;
  openedBy: string;
  openedAt: string;
  closedBy?: string;
  closedAt?: string;
  isAutoClosed?: boolean;
  summary: ShiftLedgerSummary;
  ledger: ShiftLedgerItem[];
}
