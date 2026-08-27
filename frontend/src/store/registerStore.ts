import { create } from 'zustand';
import { RegisterData, DifferenceStatus } from '../types';
import { shiftService } from '../services/shift.service';
import { ShiftRecord } from '../types/shift';

// Map the backend ShiftRecord shape → frontend RegisterData shape
function shiftToRegister(shift: ShiftRecord): RegisterData {
  const statusMap: Record<string, RegisterData['status']> = {
    Open:   'OPEN',
    Closed: 'CLOSED',
  };
  const diffMap: Record<string, DifferenceStatus> = {
    Balanced: 'Balanced',
    Short:    'Short',
    Over:     'Over',
  };

  return {
    id:               shift.id,
    date:             shift.date,
    cashier:          shift.openedBy,
    shiftOpen:        shift.openedAt,
    shiftClose:       shift.closedAt,

    // Real sales aggregates from the backend shift response
    billsCount:       shift.billsCount  ?? 0,
    grossSales:       shift.grossSales  ?? 0,
    discounts:        0,
    refunds:          0,
    voids:            0,
    cashSales:        shift.cashSales   ?? 0,
    onlineSales:      shift.onlineSales ?? 0,
    khataSales:       shift.khataSales  ?? 0,

    openingBalance:   shift.openingCash,
    expenses:         0,
    expectedCash:     shift.expectedCash,
    countedCash:      shift.countedCash,

    variance:         shift.difference,
    differenceStatus: shift.differenceStatus ? diffMap[shift.differenceStatus] : undefined,
    status:           statusMap[shift.status] ?? 'OPEN',
    notes:            shift.closingNotes,
  };
}

interface RegisterStore {
  currentRegister:  RegisterData | null;
  registerHistory:  RegisterData[];
  isLoading:        boolean;
  error:            string | null;

  fetchShifts:      () => Promise<void>;
  openShift:        (openingCash: number, notes?: string) => Promise<void>;
  setCountedCash:   (cash: number, notes: string) => void;
  closeRegister:    (countedCash: number, notes?: string) => Promise<void>;
  clearError:       () => void;
}

export const useRegisterStore = create<RegisterStore>((set) => ({
  currentRegister:  null,
  registerHistory:  [],
  isLoading:        false,
  error:            null,

  fetchShifts: async () => {
    set({ isLoading: true, error: null });
    try {
      const shifts = await shiftService.getShifts();
      const mapped = shifts.map(shiftToRegister);
      const current = mapped.find(r => r.status === 'OPEN') ?? null;
      const history = mapped.filter(r => r.status !== 'OPEN');
      set({ currentRegister: current, registerHistory: history, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch shifts', isLoading: false });
    }
  },

  openShift: async (openingCash: number, notes = '') => {
    set({ isLoading: true, error: null });
    try {
      const shift = await shiftService.openShift(openingCash, notes);
      const register = shiftToRegister(shift);
      set({ currentRegister: register, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to open shift', isLoading: false });
      throw err;
    }
  },

  // Local-only optimistic update before the close API call
  setCountedCash: (cash: number, notes: string) => {
    set((state) => {
      if (!state.currentRegister) return {};
      const variance = cash - state.currentRegister.expectedCash;
      const differenceStatus: DifferenceStatus =
        variance === 0 ? 'Balanced' : variance < 0 ? 'Short' : 'Over';
      return {
        currentRegister: {
          ...state.currentRegister,
          countedCash: cash,
          variance,
          differenceStatus,
          notes,
          status: 'COUNTED',
        },
      };
    });
  },

  closeRegister: async (countedCash: number, notes = '') => {
    set({ isLoading: true, error: null });
    try {
      const shift = await shiftService.closeShift(countedCash, notes);
      const closed = shiftToRegister(shift);
      set((state) => ({
        currentRegister:  null,
        registerHistory:  [closed, ...state.registerHistory],
        isLoading:        false,
      }));
    } catch (err: any) {
      set({ error: err.message || 'Failed to close shift', isLoading: false });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
}));
