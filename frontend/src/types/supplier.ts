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
  payableBalance: number;
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
  notes?: string;
}
