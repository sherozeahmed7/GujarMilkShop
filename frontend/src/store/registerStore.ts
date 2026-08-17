import { create } from 'zustand';
import { RegisterData, DifferenceStatus } from '../types';

interface RegisterStore {
  currentRegister: RegisterData;
  registerHistory: RegisterData[];
  
  setCountedCash: (cash: number, notes: string) => void;
  closeRegister: () => void;
}

const generateMockHistory = (): RegisterData[] => {
  return [
    {
      id: 'REG-2026-08-16',
      date: '2026-08-16',
      cashier: 'System Admin',
      shiftOpen: '2026-08-16T06:00:00+05:00',
      shiftClose: '2026-08-16T22:30:00+05:00',
      billsCount: 412,
      grossSales: 150000,
      discounts: 500,
      refunds: 0,
      voids: 2,
      cashSales: 110000,
      onlineSales: 15000,
      khataSales: 24500,
      openingBalance: 4000,
      expenses: 1500,
      expectedCash: 112500, // 4000 + 110000 - 1500 - 0 (Note: Khata isn't cash in drawer directly, but let's assume Expected Cash = Opening + Cash Sales - Expenses - Refunds)
      countedCash: 112500,
      variance: 0,
      differenceStatus: 'Balanced',
      status: 'CLOSED',
    },
    {
      id: 'REG-2026-08-15',
      date: '2026-08-15',
      cashier: 'System Admin',
      shiftOpen: '2026-08-15T05:50:00+05:00',
      shiftClose: '2026-08-15T22:15:00+05:00',
      billsCount: 389,
      grossSales: 142000,
      discounts: 200,
      refunds: 1000,
      voids: 0,
      cashSales: 105000,
      onlineSales: 12000,
      khataSales: 23800,
      openingBalance: 5000,
      expenses: 2000,
      expectedCash: 107000, // 5000 + 105000 - 2000 - 1000
      countedCash: 106800,
      variance: -200,
      differenceStatus: 'Short',
      status: 'CLOSED',
    },
    {
      id: 'REG-2026-08-14',
      date: '2026-08-14',
      cashier: 'System Admin',
      shiftOpen: '2026-08-14T06:10:00+05:00',
      shiftClose: '2026-08-14T23:00:00+05:00',
      billsCount: 450,
      grossSales: 165000,
      discounts: 1000,
      refunds: 0,
      voids: 5,
      cashSales: 120000,
      onlineSales: 18000,
      khataSales: 26000,
      openingBalance: 4000,
      expenses: 0,
      expectedCash: 124000, // 4000 + 120000 - 0 - 0
      countedCash: 124500,
      variance: 500,
      differenceStatus: 'Over',
      status: 'CLOSED',
    }
  ];
};

const getInitialCurrentRegister = (): RegisterData => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  today.setHours(6, 0, 0, 0); // Open at 6 AM

  const openingBalance = 4000;
  const cashSales = 131343;
  const khataSales = 28770;
  const onlineSales = 360;
  const expenses = 0;
  const refunds = 0;
  
  // Cash Drawer Expected Cash = Opening + Cash Sales - Expenses - Refunds
  const expectedCash = openingBalance + cashSales - expenses - refunds;

  return {
    id: `REG-${dateStr}`,
    date: dateStr,
    cashier: 'System Admin',
    shiftOpen: today.toISOString(),
    billsCount: 544,
    grossSales: 160473,
    discounts: 70,
    refunds,
    voids: 0,
    cashSales,
    onlineSales,
    khataSales,
    openingBalance,
    expenses,
    expectedCash,
    status: 'OPEN',
  };
};

export const useRegisterStore = create<RegisterStore>((set) => ({
  currentRegister: getInitialCurrentRegister(),
  registerHistory: generateMockHistory(),

  setCountedCash: (cash: number, notes: string) => {
    set((state) => {
      const variance = cash - state.currentRegister.expectedCash;
      let differenceStatus: DifferenceStatus = 'Balanced';
      if (variance < 0) differenceStatus = 'Short';
      if (variance > 0) differenceStatus = 'Over';

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

  closeRegister: () => {
    set((state) => {
      const closingTime = new Date().toISOString();
      const closedRegister: RegisterData = {
        ...state.currentRegister,
        status: 'CLOSED',
        shiftClose: closingTime,
      };

      return {
        // Move current to history
        registerHistory: [closedRegister, ...state.registerHistory],
        // Mock opening a new register for tomorrow just so UI has something to show,
        // or we can leave it closed. Let's leave it as a fresh open register to simulate next day.
        currentRegister: {
          ...getInitialCurrentRegister(),
          id: `REG-${Date.now()}`, // unique id
          openingBalance: closedRegister.countedCash || 0, // carry over
          cashSales: 0,
          onlineSales: 0,
          khataSales: 0,
          expenses: 0,
          refunds: 0,
          grossSales: 0,
          discounts: 0,
          voids: 0,
          billsCount: 0,
          expectedCash: closedRegister.countedCash || 0,
          countedCash: undefined,
          variance: undefined,
          differenceStatus: undefined,
          status: 'OPEN',
        }
      };
    });
  },
}));
