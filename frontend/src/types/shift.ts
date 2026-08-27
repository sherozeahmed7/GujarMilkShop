export type ShiftStatus = 'Open' | 'Closed';

export type ShiftDifferenceStatus = 'Balanced' | 'Short' | 'Over';

export interface ShiftRecord {
  id: string;
  date: string;
  
  openedBy: string;
  openedAt: string;
  openingCash: number;
  openingNotes?: string;

  closedBy?: string;
  closedAt?: string;
  
  expectedCash: number;
  countedCash?: number;
  difference?: number;
  differenceStatus?: ShiftDifferenceStatus;
  closingNotes?: string;

  status: ShiftStatus;

  // Sales aggregates (populated by backend from real sales in the shift window)
  billsCount:  number;
  grossSales:  number;
  cashSales:   number;
  onlineSales: number;
  khataSales:  number;
}
