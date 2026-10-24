export type MilkType = 'Mixed' | 'Cow' | 'Buffalo';
export type ShiftType = 'Morning' | 'Evening';
export type CycleType = 'Monthly Cycle' | '1-Day Cycle' | 'Weekly Cycle';

export interface Supplier {
  id: string;
  name: string;
  code: string;
  phone?: string;
  defaultRate: number;
  cowRate: number;
  buffaloRate: number;
  cycleType: CycleType;
  isActive: boolean;
  guaranteedAdvance: number;
  /** Opening / previous unpaid remaining balance */
  openingBalance?: number;
  /** Purchases − payments (before advance) */
  grossPayable?: number;
  /** Purchases in current cycle (month / week / day) */
  currentAmount?: number;
  /** Purchases before current cycle */
  previousAmount?: number;
  /** Current + Previous — amount we have to pay (before paid/advance) */
  totalAmount?: number;
  /** Sum of payments made to supplier */
  paidAmount?: number;
  /** totalAmount − paid − advance */
  remainingBalance?: number;
  /** Alias of remainingBalance (can be negative = advance credit left) */
  /** Morning milk delivery in kg for selected date filter */
  morningQty?: number;
  /** Evening milk delivery in kg for selected date filter */
  eveningQty?: number;
  /** Total milk delivery in kg for selected date filter */
  totalQty?: number;
  /** Effective/average purchase rate for selected date filter */
  rate?: number;
  /** Total purchases amount (Rs.) in selected date filter */
  periodPurchases?: number;
  payableBalance: number;
  nextCycleCredit?: number;
}

export interface MilkCollection {
  id: string;
  supplierId: string;
  date: string; // YYYY-MM-DD
  shift: ShiftType;
  milkType: MilkType;
  quantity: number;
  rate: number;
  amount: number;
  notes?: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  date: string;
  amount: number;
  method?: string;
  paymentSource?: 'shift' | 'hand';
  notes?: string;
  /** Optional write-off sent with addPayment — creates a separate discount payment row */
  discount?: number;
  shiftId?: number | null;
  shiftDate?: string | null;
  shiftStatus?: string | null;
}

/** Row from GET /suppliers/payments — farm + shift attribution */
export interface SupplierPaymentRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierCode: string;
  date: string;
  amount: number;
  method: string;
  notes?: string | null;
  createdAt?: string;
  createdBy?: string | null;
  shiftId?: number | null;
  shiftDate?: string | null;
  shiftStatus?: string | null;
  shiftOpenedAt?: string | null;
  shiftClosedAt?: string | null;
}
