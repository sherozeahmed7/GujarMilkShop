import { create } from 'zustand';
import { ShiftRecord } from '../types';
import { shiftService } from '../services/shift.service';

interface ShiftStore {
  shifts: ShiftRecord[];
  isLoading: boolean;
  error: string | null;
  
  // Computes the current open shift
  getCurrentShift: () => ShiftRecord | null;
  
  openShift: (openingCash: number, openingNotes: string) => Promise<void>;
  closeShift: (countedCash: number, closingNotes: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

export const useShiftStore = create<ShiftStore>((set, get) => ({
  shifts: [],
  isLoading: false,
  error: null,

  getCurrentShift: () => {
    const currentUserId = Number(localStorage.getItem('userId'));
    const userName = (localStorage.getItem('userName') || '').toLowerCase().trim();
    if (currentUserId || userName) {
      const userShift = get().shifts.find(
        (s: any) =>
          s.status === 'Open' &&
          (s.openedById === currentUserId ||
            (userName && (s.openedBy || '').toLowerCase().trim() === userName))
      );
      if (userShift) return userShift;
    }
    return get().shifts.find((s) => s.status === 'Open') || null;
  },

  openShift: async (openingCash, openingNotes) => {
    set({ isLoading: true, error: null });
    try {
      await shiftService.openShift(openingCash, openingNotes);
      await get().refreshData();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  closeShift: async (countedCash, closingNotes) => {
    set({ isLoading: true, error: null });
    try {
      await shiftService.closeShift(countedCash, closingNotes);
      await get().refreshData();
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
      throw error;
    }
  },

  refreshData: async () => {
    set({ isLoading: true, error: null });
    try {
      const shifts = await shiftService.getShifts();
      set({ shifts, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },
}));
