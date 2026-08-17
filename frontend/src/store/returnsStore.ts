import { create } from 'zustand';
import { MockBill, ReturnRecord } from '../types';
import { mockBills, initialReturnRecords } from '../data/returnsMockData';

interface ReturnsStore {
  bills: MockBill[];
  returns: ReturnRecord[];
  findBill: (query: string) => MockBill | null;
  addReturn: (record: ReturnRecord) => void;
}

export const useReturnsStore = create<ReturnsStore>((set, get) => ({
  bills: mockBills,
  returns: initialReturnRecords,

  findBill: (query: string): MockBill | null => {
    if (!query.trim()) return null;
    const q = query.trim().toUpperCase();
    return get().bills.find(
      (b) => b.billNumber.toUpperCase() === q
    ) ?? null;
  },

  addReturn: (record: ReturnRecord) => {
    set((state) => ({
      returns: [record, ...state.returns],
    }));
  },
}));
