import { create } from 'zustand';
import { MockBill, ReturnRecord } from '../types';
import * as returnsApi from '../services/returnsService';

interface ReturnsStore {
  returns:     ReturnRecord[];
  isLoading:   boolean;
  error:       string | null;

  fetchReturns: (filters?: { fromDate?: string; toDate?: string }) => Promise<void>;
  findBill:     (query: string) => Promise<MockBill | null>;
  addReturn:    (data: Omit<ReturnRecord, 'returnId'>) => Promise<ReturnRecord>;
  clearError:   () => void;
}

export const useReturnsStore = create<ReturnsStore>((set) => ({
  returns:   [],
  isLoading: false,
  error:     null,

  fetchReturns: async (filters?) => {
    set({ isLoading: true, error: null });
    try {
      const returns = await returnsApi.getReturns(filters);
      set({ returns, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch returns', isLoading: false });
    }
  },

  findBill: async (query: string) => {
    if (!query.trim()) return null;
    return returnsApi.lookupBill(query.trim());
  },

  addReturn: async (data) => {
    const record = await returnsApi.createReturn(data);
    set((state) => ({ returns: [record, ...state.returns] }));
    return record;
  },

  clearError: () => set({ error: null }),
}));
