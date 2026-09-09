export interface MilkProductsDailyStock {
  date: string; // YYYY-MM-DD
  milkTotal: number;
  milkRatePerKg?: number;
  milkCostPerKg?: number;
  lassiRatePerKg?: number;
  butterRatePerKg?: number;
  milkAddedCost?: number;
  lassiBreakEvenKg?: number;
  butterBreakEvenKg?: number;
  butterBreakEvenCost?: number;
  butterInventoryValue?: number;
  butterTotalValue?: number;
  butterRecoveryResult?: number;
  butterMilkCostShortfall?: number;
  milkRemainingKg?: number;
  milkRecoveredFromLassi?: number;
  milkRecoveredFromButter?: number;
  milkRecoveryKgFromButter?: number;
  milkLossCost?: number;
  
  // Lassi (Daily - resets to 0 next day)
  lassiProduced: number;
  lassiSold: number;
  lassiRemaining: number;
  
  // Butter (Persistent)
  butterOpening: number;
  butterProduced: number;
  butterSold: number;
  butterConverted: number;
  butterClosing: number;
  
  // Ghee (Persistent)
  gheeOpening: number;
  gheeProduced: number;
  gheeSold: number;
  gheeClosing: number;
}

export type TransactionType = 
  | 'milk_added'
  | 'lassi_produced'
  | 'lassi_sold'
  | 'butter_produced'
  | 'butter_sold'
  | 'butter_converted'
  | 'ghee_produced'
  | 'ghee_sold';

export interface MilkProductTransaction {
  id: string;
  date: string;
  product: 'Milk' | 'Lassi' | 'Butter' | 'Ghee';
  type: TransactionType;
  quantity: number;
  reference?: string;
  notes?: string;
  createdAt: string;
}

export interface ButterGheeConversion {
  id: string;
  date: string;
  butterUsed: number;
  gheeProduced: number;
  notes?: string;
  createdAt: string;
}
