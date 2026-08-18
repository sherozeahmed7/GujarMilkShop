import { ExpenseRecord, ExpenseSummaryData, CostBreakdownItem } from '../types';

const STORAGE_KEY = 'gujar_pos_expenses';

// Helper to get from local storage
const getStoredExpenses = (): ExpenseRecord[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

// Helper to save to local storage
const saveStoredExpenses = (expenses: ExpenseRecord[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
};

export const getExpenses = async (): Promise<ExpenseRecord[]> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));
  return getStoredExpenses().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const getExpenseById = async (id: string): Promise<ExpenseRecord | undefined> => {
  await new Promise(resolve => setTimeout(resolve, 100));
  const expenses = getStoredExpenses();
  return expenses.find(e => e.id === id);
};

export const createExpense = async (data: Omit<ExpenseRecord, 'id' | 'createdAt'>): Promise<ExpenseRecord> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  const expenses = getStoredExpenses();
  const newExpense: ExpenseRecord = {
    ...data,
    id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString(),
  };
  saveStoredExpenses([...expenses, newExpense]);
  return newExpense;
};

export const updateExpense = async (id: string, data: Partial<ExpenseRecord>): Promise<ExpenseRecord> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  const expenses = getStoredExpenses();
  const index = expenses.findIndex(e => e.id === id);
  if (index === -1) throw new Error('Expense not found');
  
  const updatedExpense = { ...expenses[index], ...data };
  expenses[index] = updatedExpense;
  saveStoredExpenses(expenses);
  return updatedExpense;
};

export const deleteExpense = async (id: string): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 400));
  const expenses = getStoredExpenses();
  const filtered = expenses.filter(e => e.id !== id);
  saveStoredExpenses(filtered);
};

export const getExpenseSummary = async (): Promise<ExpenseSummaryData> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const expenses = getStoredExpenses();
  
  // Example dummy stock and avg cost, could be calculated or fetched from product DB
  const stock = 47.75; 
  const avgCost = 190.00;
  
  // Summarize today's or overall? The UI seems to show totals for context, 
  // Let's just summarize the existing records
  const grossLoss = expenses.reduce((sum, e) => sum + e.grossLoss, 0);
  const netExpense = expenses.reduce((sum, e) => sum + e.netExpense, 0);

  return {
    stock,
    avgCost,
    grossLoss,
    netExpense
  };
};

export const getCostBreakdown = async (): Promise<CostBreakdownItem[]> => {
  await new Promise(resolve => setTimeout(resolve, 200));
  const expenses = getStoredExpenses();
  
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const totalAmount = monthlyExpenses.reduce((sum, e) => sum + e.netExpense, 0);
  
  if (totalAmount === 0) return [];

  const categoryTotals: Record<string, number> = {};
  monthlyExpenses.forEach(e => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.netExpense;
  });

  return Object.entries(categoryTotals).map(([category, amount]) => ({
    category,
    amount,
    percentage: Math.round((amount / totalAmount) * 100)
  })).sort((a, b) => b.amount - a.amount);
};
