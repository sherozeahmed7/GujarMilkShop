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
  notes?: string;
}
