export type ExpenseCategory = string;

export interface ExpensePaymentRecord {
  id: number;
  expenseId: number;
  amount: number;
  shiftId?: number | null;
  date: string;
  addedBy: string;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  date: string; // ISO string YYYY-MM-DD
  /** Free-text product / expense label (Milk, Yogurt, Shoppers, …) */
  category: ExpenseCategory;
  description?: string;
  quantity: number;
  unitCost: number;
  grossLoss: number;
  soldRecovery: number;
  netExpense: number;
  /** Total expense bill */
  amount: number;
  /** Cash paid from drawer so far */
  paidAmount: number;
  /** amount − paidAmount */
  remaining: number;
  reason?: string;
  addedBy: string;
  createdAt: string;
  payments?: ExpensePaymentRecord[];
}

export interface ExpenseSummaryData {
  stock: number;
  avgCost: number;
  grossLoss: number;
  netExpense: number;
  paid?: number;
  remaining?: number;
}

export interface CostBreakdownItem {
  category: string;
  amount: number;
  percentage: number;
}
