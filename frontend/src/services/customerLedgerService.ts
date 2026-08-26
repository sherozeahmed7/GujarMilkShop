export interface MilkEntry {
  id: string;
  customerId: string;
  date: string; // YYYY-MM-DD
  quantity: number;
  rate: number;
  amount: number;
  time: string;
  product?: string;
}

export interface PaymentEntry {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  addedBy: string;
}

export interface LedgerSummary {
  totalMilk: number;
  currentMonthAmount: number;
  previousBalance: number;
  totalPayable: number;
  totalReceived: number;
  remaining: number;
}

/** Generate a YYYY-MM-DD string for the given year/month/day */
const d = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Build mock entries for a given year/month */
function buildMockEntries(year: number, month: number): Omit<MilkEntry, 'customerId'>[] {
  return [
    { id: `milk-${year}${month}-01a`, date: d(year, month, 1),  quantity: 2.5, rate: 240, amount: 600,  time: '08:30', product: 'Milk' },
    { id: `milk-${year}${month}-01b`, date: d(year, month, 1),  quantity: 1.0, rate: 240, amount: 240,  time: '18:00', product: 'Milk' },
    { id: `milk-${year}${month}-02a`, date: d(year, month, 2),  quantity: 3.0, rate: 240, amount: 720,  time: '09:00', product: 'Milk' },
    { id: `milk-${year}${month}-03a`, date: d(year, month, 3),  quantity: 1.5, rate: 240, amount: 360,  time: '08:00', product: 'Milk' },
    { id: `milk-${year}${month}-03b`, date: d(year, month, 3),  quantity: 0.5, rate: 200, amount: 100,  time: '15:00', product: 'Yogurt' },
    { id: `milk-${year}${month}-05a`, date: d(year, month, 5),  quantity: 2.0, rate: 240, amount: 480,  time: '08:30', product: 'Milk' },
    { id: `milk-${year}${month}-07a`, date: d(year, month, 7),  quantity: 3.5, rate: 240, amount: 840,  time: '07:45', product: 'Milk' },
    { id: `milk-${year}${month}-07b`, date: d(year, month, 7),  quantity: 1.0, rate: 150, amount: 150,  time: '17:00', product: 'Lassi' },
    { id: `milk-${year}${month}-10a`, date: d(year, month, 10), quantity: 2.5, rate: 240, amount: 600,  time: '08:30', product: 'Milk' },
    { id: `milk-${year}${month}-12a`, date: d(year, month, 12), quantity: 2.0, rate: 240, amount: 480,  time: '09:00', product: 'Milk' },
    { id: `milk-${year}${month}-14a`, date: d(year, month, 14), quantity: 4.0, rate: 240, amount: 960,  time: '08:00', product: 'Milk' },
    { id: `milk-${year}${month}-15a`, date: d(year, month, 15), quantity: 2.5, rate: 240, amount: 600,  time: '08:30', product: 'Milk' },
    { id: `milk-${year}${month}-17a`, date: d(year, month, 17), quantity: 3.0, rate: 240, amount: 720,  time: '08:00', product: 'Milk' },
    { id: `milk-${year}${month}-17b`, date: d(year, month, 17), quantity: 0.5, rate: 200, amount: 100,  time: '14:00', product: 'Yogurt' },
    { id: `milk-${year}${month}-19a`, date: d(year, month, 19), quantity: 2.0, rate: 240, amount: 480,  time: '08:30', product: 'Milk' },
    { id: `milk-${year}${month}-21a`, date: d(year, month, 21), quantity: 3.5, rate: 240, amount: 840,  time: '08:00', product: 'Milk' },
    { id: `milk-${year}${month}-23a`, date: d(year, month, 23), quantity: 2.5, rate: 240, amount: 600,  time: '08:30', product: 'Milk' },
    { id: `milk-${year}${month}-25a`, date: d(year, month, 25), quantity: 2.0, rate: 240, amount: 480,  time: '08:00', product: 'Milk' },
    { id: `milk-${year}${month}-25b`, date: d(year, month, 25), quantity: 1.0, rate: 150, amount: 150,  time: '16:00', product: 'Lassi' },
    { id: `milk-${year}${month}-28a`, date: d(year, month, 28), quantity: 3.0, rate: 240, amount: 720,  time: '08:30', product: 'Milk' },
  ];
}

/** Build mock payments for a given year/month */
function buildMockPayments(year: number, month: number): Omit<PaymentEntry, 'customerId'>[] {
  return [
    { id: `pay-${year}${month}-01`, date: d(year, month, 10), amount: 3000, paymentMethod: 'Cash',      reference: `REC-${year}${month}01`, addedBy: 'System Admin' },
    { id: `pay-${year}${month}-02`, date: d(year, month, 26), amount: 2000, paymentMethod: 'EasyPaisa', reference: `TRX-${year}${month}02`, addedBy: 'System Admin' },
  ];
}

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const customerLedgerService = {
  async getCustomer(customerId: string) {
    await delay(200);
    // Mock: return a generic customer. Replace with real API call later.
    return {
      id: customerId,
      name: 'Ahmed (Demo)',
      phone: '0316-8517824',
      type: 'monthly_ledger',
      balance: 2123,
    };
  },

  async getMonthlyMilkEntries(customerId: string, month: number, year: number): Promise<MilkEntry[]> {
    await delay(300);
    // Build entries for requested month/year and stamp with the actual customerId
    return buildMockEntries(year, month).map(e => ({ ...e, customerId }));
  },

  async getMonthlyPayments(customerId: string, month: number, year: number): Promise<PaymentEntry[]> {
    await delay(200);
    return buildMockPayments(year, month).map(p => ({ ...p, customerId }));
  },

  async getPreviousBalance(_customerId: string, _month: number, _year: number): Promise<number> {
    await delay(100);
    // Mock: fixed previous balance. Replace with real API call later.
    return 5000;
  },

  async getMonthlySummary(customerId: string, month: number, year: number): Promise<LedgerSummary> {
    const [entries, payments, prevBalance] = await Promise.all([
      this.getMonthlyMilkEntries(customerId, month, year),
      this.getMonthlyPayments(customerId, month, year),
      this.getPreviousBalance(customerId, month, year),
    ]);

    const totalMilk = entries.reduce((sum, e) => sum + e.quantity, 0);
    const currentMonthAmount = entries.reduce((sum, e) => sum + e.amount, 0);
    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
    const totalPayable = prevBalance + currentMonthAmount;
    const remaining = totalPayable - totalReceived;

    return {
      totalMilk,
      currentMonthAmount,
      previousBalance: prevBalance,
      totalPayable,
      totalReceived,
      remaining,
    };
  },
};
