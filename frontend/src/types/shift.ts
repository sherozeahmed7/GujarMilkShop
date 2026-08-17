export type ShiftStatus = 'Open' | 'Closed';

export type ShiftDifferenceStatus = 'Balanced' | 'Short' | 'Over';

export interface ShiftRecord {
  id: string;
  date: string; // ISO string representing the shift day
  
  openedBy: string;
  openedAt: string; // ISO timestamp
  openingCash: number;
  openingNotes?: string;

  closedBy?: string;
  closedAt?: string; // ISO timestamp
  
  expectedCash: number;
  countedCash?: number;
  difference?: number;
  differenceStatus?: ShiftDifferenceStatus;
  closingNotes?: string;

  status: ShiftStatus;
}
