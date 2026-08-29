export interface MilkProductsDailyStock {
  date: string; // YYYY-MM-DD
  milkTotal: number;
  
  lassiProduced: number;
  lassiSold: number;
  lassiRemaining: number;
  lassiDiscarded?: number;
  
  butterOpening: number;
  butterProduced: number;
  butterSold: number;
  butterConverted: number;
  butterClosing: number;
  butterDiscarded?: number;
  butterOldestDate?: string | null;
  butterAgeDays?: number;
  butterExpired?: boolean;
  
  gheeOpening: number;
  gheeProduced: number;
  gheeSold: number;
  gheeClosing: number;
  gheeDiscarded?: number;
  gheeOldestDate?: string | null;
  gheeAgeDays?: number;
  gheeExpired?: boolean;
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
