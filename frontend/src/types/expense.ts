export type ExpenseCategory = 
  | 'Milk'
  | 'Yogurt'
  | 'Electricity'
  | 'Gas'
  | 'Water'
  | 'Packaging'
  | 'Other';

export interface ExpenseRecord {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  category: ExpenseCategory;
  description?: string;
  quantity: number;
  unitCost: number;
  grossLoss: number;
  soldRecovery: number;
  netExpense: number;
  reason?: string;
  addedBy: string;
  createdAt: string; // ISO string
}

export interface ExpenseSummaryData {
  stock: number;
  avgCost: number;
  grossLoss: number;
  netExpense: number;
}

export interface CostBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
}
