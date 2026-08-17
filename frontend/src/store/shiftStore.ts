import { create } from 'zustand';
import { ShiftRecord } from '../types';
import { mockShifts } from '../data/shiftMockData';

interface ShiftStore {
  shifts: ShiftRecord[];
  
  // Computes the current open shift
  getCurrentShift: () => ShiftRecord | null;
  
  openShift: (openingCash: number, openingNotes: string) => void;
  closeShift: (countedCash: number, closingNotes: string) => void;
  refreshData: () => void;
}

export const useShiftStore = create<ShiftStore>((set, get) => ({
  shifts: mockShifts,

  getCurrentShift: () => {
    return get().shifts.find((s) => s.status === 'Open') || null;
  },

  openShift: (openingCash, openingNotes) => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const newShift: ShiftRecord = {
      id: `SHIFT-${dateStr}`,
      date: dateStr,
      openedBy: 'System Admin',
      openedAt: today.toISOString(),
      openingCash,
      expectedCash: openingCash, // Usually, you'd calculate expected cash based on POS sales.
      openingNotes,
      status: 'Open',
    };
    
    set((state) => ({
      shifts: [newShift, ...state.shifts]
    }));
  },

  closeShift: (countedCash, closingNotes) => {
    set((state) => {
      const current = state.shifts.find(s => s.status === 'Open');
      if (!current) return state;

      const difference = countedCash - current.expectedCash;
      let differenceStatus: 'Balanced' | 'Short' | 'Over' = 'Balanced';
      
      if (difference < 0) differenceStatus = 'Short';
      if (difference > 0) differenceStatus = 'Over';

      const closedShift: ShiftRecord = {
        ...current,
        status: 'Closed',
        closedBy: 'System Admin',
        closedAt: new Date().toISOString(),
        countedCash,
        difference,
        differenceStatus,
        closingNotes,
      };

      return {
        shifts: state.shifts.map(s => s.id === current.id ? closedShift : s)
      };
    });
  },

  refreshData: () => {
    set({ shifts: [...mockShifts] });
  },
}));
