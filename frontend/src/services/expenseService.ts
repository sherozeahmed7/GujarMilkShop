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
  expenseType?: 'SHOP' | 'PERSONAL';
}): Promise<ExpenseRecord[]> => {
  const params: Record<string, string> = {};
  if (filters?.fromDate) params.fromDate = filters.fromDate;
  if (filters?.toDate)   params.toDate   = filters.toDate;
  if (filters?.category) params.category = filters.category;
  if (filters?.expenseType) params.expenseType = filters.expenseType;
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
  data: Omit<ExpenseRecord, 'id' | 'createdAt'> & { expenseType?: 'SHOP' | 'PERSONAL' }
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

export const recordPersonalReceive = async (data: {
  amount: number;
  date?: string;
  notes?: string;
}): Promise<any> => {
  const res = await apiClient.post('/expenses/personal/receive', data);
  return res.data;
};

/** Record cash received against a specific personal expense (no FIFO). */
export const recordPersonalReceiveForExpense = async (
  expenseId: string,
  data: { amount: number; date?: string; notes?: string }
): Promise<any> => {
  const res = await apiClient.post(`/expenses/${expenseId}/personal-receive`, data);
  return res.data;
};

/** Return cash previously received against a specific personal expense.
 *  Reduces paidAmount and increases remaining by the returned amount.
 *  Cannot exceed the existing paidAmount. */
export const recordPersonalReturnForExpense = async (
  expenseId: string,
  data: { amount: number; date?: string; notes?: string }
): Promise<any> => {
  const res = await apiClient.post(`/expenses/${expenseId}/personal-return`, data);
  return res.data;
};

export const deleteExpense = async (id: string): Promise<void> => {
  await apiClient.delete(`/expenses/${id}`);
};

export const getExpenseSummary = async (expenseType?: 'SHOP' | 'PERSONAL'): Promise<ExpenseSummaryData> => {
  const params = expenseType ? { expenseType } : undefined;
  const res = await apiClient.get('/expenses/summary', params);
  return res.data as ExpenseSummaryData;
};

export const getCostBreakdown = async (): Promise<CostBreakdownItem[]> => {
  const res = await apiClient.get('/expenses/breakdown');
  return (res.data ?? []) as CostBreakdownItem[];
};
