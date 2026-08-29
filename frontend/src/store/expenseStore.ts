import { create } from 'zustand';
import { ExpenseRecord, ExpenseSummaryData, CostBreakdownItem } from '../types';
import * as expenseApi from '../services/expenseService';

interface ExpenseStore {
  expenses: ExpenseRecord[];
  summary: ExpenseSummaryData;
  breakdown: CostBreakdownItem[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  
  // Actions
  fetchExpenses: () => Promise<void>;
  createExpense: (data: Omit<ExpenseRecord, 'id' | 'createdAt'>) => Promise<void>;
  updateExpense: (id: string, data: Partial<ExpenseRecord>) => Promise<void>;
  payExpense: (id: string, amount: number) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useExpenseStore = create<ExpenseStore>((set, get) => ({
  expenses: [],
  summary: { stock: 0, avgCost: 0, grossLoss: 0, netExpense: 0 },
  breakdown: [],
  isLoading: false,
  isSaving: false,
  error: null,

  fetchExpenses: async () => {
    set({ isLoading: true, error: null });
    try {
      const [expenses, summary, breakdown] = await Promise.all([
        expenseApi.getExpenses(),
        expenseApi.getExpenseSummary(),
        expenseApi.getCostBreakdown()
      ]);
      set({ expenses, summary, breakdown, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch expenses', isLoading: false });
    }
  },

  createExpense: async (data) => {
    set({ isSaving: true, error: null });
    try {
      await expenseApi.createExpense(data);
      await get().fetchExpenses(); // Refresh all data to keep summary/breakdown in sync
      set({ isSaving: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to save expense', isSaving: false });
      throw error;
    }
  },

  updateExpense: async (id, data) => {
    set({ isSaving: true, error: null });
    try {
      await expenseApi.updateExpense(id, data);
      await get().fetchExpenses();
      set({ isSaving: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to update expense', isSaving: false });
      throw error;
    }
  },

  payExpense: async (id, amount) => {
    set({ isSaving: true, error: null });
    try {
      await expenseApi.payExpense(id, amount);
      await get().fetchExpenses();
      set({ isSaving: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to record payment', isSaving: false });
      throw error;
    }
  },

  deleteExpense: async (id) => {
    set({ isSaving: true, error: null });
    try {
      await expenseApi.deleteExpense(id);
      await get().fetchExpenses();
      set({ isSaving: false });
    } catch (error: any) {
      set({ error: error.message || 'Failed to delete expense', isSaving: false });
      throw error;
    }
  },

  clearError: () => set({ error: null })
}));
