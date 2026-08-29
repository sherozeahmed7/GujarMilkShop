/**
 * Expense service — calls real /api/expenses backend.
 * Drop-in replacement for the old localStorage implementation.
 */
import { ExpenseRecord, ExpenseSummaryData, CostBreakdownItem } from '../types';
import { apiClient } from './apiClient';

export const getExpenses = async (filters?: {
  fromDate?: string;
  toDate?: string;
  category?: string;
}): Promise<ExpenseRecord[]> => {
  const params: Record<string, string> = {};
  if (filters?.fromDate) params.fromDate = filters.fromDate;
  if (filters?.toDate)   params.toDate   = filters.toDate;
  if (filters?.category) params.category = filters.category;
  const res = await apiClient.get('/expenses', Object.keys(params).length ? params : undefined);
  return (res.data ?? []) as ExpenseRecord[];
};

export const getExpenseById = async (id: string): Promise<ExpenseRecord | undefined> => {
  try {
    const res = await apiClient.get(`/expenses/${id}`);
    return res.data as ExpenseRecord;
  } catch {
    return undefined;
  }
};

export const createExpense = async (
  data: Omit<ExpenseRecord, 'id' | 'createdAt'>
): Promise<ExpenseRecord> => {
  const res = await apiClient.post('/expenses', data);
  return res.data as ExpenseRecord;
};

export const updateExpense = async (
  id: string,
  data: Partial<ExpenseRecord>
): Promise<ExpenseRecord> => {
  const res = await apiClient.put(`/expenses/${id}`, data);
  return res.data as ExpenseRecord;
};

export const payExpense = async (
  id: string,
  amount: number,
  date?: string
): Promise<ExpenseRecord> => {
  const res = await apiClient.post(`/expenses/${id}/pay`, {
    amount,
    ...(date ? { date } : {}),
  });
  return res.data as ExpenseRecord;
};

export const deleteExpense = async (id: string): Promise<void> => {
  await apiClient.delete(`/expenses/${id}`);
};

export const getExpenseSummary = async (): Promise<ExpenseSummaryData> => {
  const res = await apiClient.get('/expenses/summary');
  return res.data as ExpenseSummaryData;
};

export const getCostBreakdown = async (): Promise<CostBreakdownItem[]> => {
  const res = await apiClient.get('/expenses/breakdown');
  return (res.data ?? []) as CostBreakdownItem[];
};
