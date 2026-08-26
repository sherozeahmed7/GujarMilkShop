// ─── Types ────────────────────────────────────────────────────────────────────

export interface PurchaseEntry {
  id: string;
  supplierId: string;
  date: string; // YYYY-MM-DD
  product: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  time: string;
}

export interface SupplierPaymentEntry {
  id: string;
  supplierId: string;
  date: string; // YYYY-MM-DD
  amount: number;
  paymentMethod: string;
  reference: string;
  addedBy: string;
}

export interface SupplierLedgerSummary {
  currentMonthAmount: number;
  previousBalance: number; // What we owed from previous month
  totalPayable: number;    // previousBalance + currentMonthAmount
  totalPaid: number;       // Payments made this month
  remaining: number;       // totalPayable - totalPaid (we owe supplier)
}

export interface SupplierInfo {
  id: string;
  name: string;
  phone: string;
  cycleType: string;
  payableBalance: number;
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Build a YYYY-MM-DD string */
const dt = (year: number, month: number, day: number) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

/** Simulate network delay */
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Generate rich mock purchase entries for the requested month/year.
 * The supplierId is stamped at query time so any real ID shows data.
 * Replace this function body with a real API call when backend is ready.
 */
function buildMockPurchaseEntries(
  supplierId: string,
  year: number,
  month: number
): PurchaseEntry[] {
  const base: Omit<PurchaseEntry, 'supplierId'>[] = [
    { id: `p-${year}${month}-01a`, date: dt(year, month, 1),  product: 'Milk',   quantity: 100, unit: 'kg', rate: 190, amount: 19000, time: '06:30' },
    { id: `p-${year}${month}-01b`, date: dt(year, month, 1),  product: 'Yogurt', quantity: 20,  unit: 'kg', rate: 250, amount: 5000,  time: '07:00' },
    { id: `p-${year}${month}-02a`, date: dt(year, month, 2),  product: 'Milk',   quantity: 120, unit: 'kg', rate: 190, amount: 22800, time: '06:15' },
    { id: `p-${year}${month}-03a`, date: dt(year, month, 3),  product: 'Milk',   quantity: 80,  unit: 'kg', rate: 190, amount: 15200, time: '06:45' },
    { id: `p-${year}${month}-03b`, date: dt(year, month, 3),  product: 'Lassi',  quantity: 15,  unit: 'L',  rate: 150, amount: 2250,  time: '07:30' },
    { id: `p-${year}${month}-05a`, date: dt(year, month, 5),  product: 'Milk',   quantity: 110, unit: 'kg', rate: 190, amount: 20900, time: '06:20' },
    { id: `p-${year}${month}-07a`, date: dt(year, month, 7),  product: 'Milk',   quantity: 95,  unit: 'kg', rate: 190, amount: 18050, time: '06:30' },
    { id: `p-${year}${month}-07b`, date: dt(year, month, 7),  product: 'Butter', quantity: 10,  unit: 'kg', rate: 600, amount: 6000,  time: '08:00' },
    { id: `p-${year}${month}-09a`, date: dt(year, month, 9),  product: 'Milk',   quantity: 130, unit: 'kg', rate: 190, amount: 24700, time: '06:00' },
    { id: `p-${year}${month}-11a`, date: dt(year, month, 11), product: 'Milk',   quantity: 100, unit: 'kg', rate: 190, amount: 19000, time: '06:30' },
    { id: `p-${year}${month}-12a`, date: dt(year, month, 12), product: 'Milk',   quantity: 115, unit: 'kg', rate: 190, amount: 21850, time: '06:45' },
    { id: `p-${year}${month}-12b`, date: dt(year, month, 12), product: 'Yogurt', quantity: 25,  unit: 'kg', rate: 250, amount: 6250,  time: '07:00' },
    { id: `p-${year}${month}-14a`, date: dt(year, month, 14), product: 'Milk',   quantity: 90,  unit: 'kg', rate: 190, amount: 17100, time: '06:15' },
    { id: `p-${year}${month}-15a`, date: dt(year, month, 15), product: 'Milk',   quantity: 110, unit: 'kg', rate: 190, amount: 20900, time: '06:30' },
    { id: `p-${year}${month}-17a`, date: dt(year, month, 17), product: 'Milk',   quantity: 100, unit: 'kg', rate: 190, amount: 19000, time: '06:30' },
    { id: `p-${year}${month}-17b`, date: dt(year, month, 17), product: 'Lassi',  quantity: 20,  unit: 'L',  rate: 150, amount: 3000,  time: '07:15' },
    { id: `p-${year}${month}-19a`, date: dt(year, month, 19), product: 'Milk',   quantity: 125, unit: 'kg', rate: 190, amount: 23750, time: '06:00' },
    { id: `p-${year}${month}-21a`, date: dt(year, month, 21), product: 'Milk',   quantity: 90,  unit: 'kg', rate: 190, amount: 17100, time: '06:30' },
    { id: `p-${year}${month}-23a`, date: dt(year, month, 23), product: 'Milk',   quantity: 105, unit: 'kg', rate: 190, amount: 19950, time: '06:45' },
    { id: `p-${year}${month}-25a`, date: dt(year, month, 25), product: 'Milk',   quantity: 110, unit: 'kg', rate: 190, amount: 20900, time: '06:15' },
    { id: `p-${year}${month}-25b`, date: dt(year, month, 25), product: 'Butter', quantity: 8,   unit: 'kg', rate: 600, amount: 4800,  time: '07:45' },
    { id: `p-${year}${month}-28a`, date: dt(year, month, 28), product: 'Milk',   quantity: 120, unit: 'kg', rate: 190, amount: 22800, time: '06:00' },
  ];
  return base.map(e => ({ ...e, supplierId }));
}

/**
 * Generate mock payments made TO the supplier for the given month/year.
 * Replace with a real API call when backend is ready.
 */
function buildMockPayments(
  supplierId: string,
  year: number,
  month: number
): SupplierPaymentEntry[] {
  const base: Omit<SupplierPaymentEntry, 'supplierId'>[] = [
    {
      id: `sp-${year}${month}-01`,
      date: dt(year, month, 10),
      amount: 80000,
      paymentMethod: 'Bank Transfer',
      reference: `TRF-${year}${month}01`,
      addedBy: 'Admin',
    },
    {
      id: `sp-${year}${month}-02`,
      date: dt(year, month, 25),
      amount: 50000,
      paymentMethod: 'Cash',
      reference: `CSH-${year}${month}02`,
      addedBy: 'Admin',
    },
  ];
  return base.map(p => ({ ...p, supplierId }));
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const supplierLedgerService = {
  /**
   * Fetch supplier info by ID.
   * Replace body with: return apiClient.get(`/suppliers/${supplierId}`)
   */
  async getSupplier(supplierId: string): Promise<SupplierInfo> {
    await delay(200);
    return {
      id: supplierId,
      name: 'Dairy Farm Supplier (Demo)',
      phone: '0300-1234567',
      cycleType: 'Monthly',
      payableBalance: 12500,
    };
  },

  /**
   * Fetch all purchase entries for a supplier in a given month/year.
   * Replace body with: return apiClient.get(`/suppliers/${supplierId}/purchases?month=${month}&year=${year}`)
   */
  async getMonthlyPurchaseEntries(
    supplierId: string,
    month: number,
    year: number
  ): Promise<PurchaseEntry[]> {
    await delay(300);
    return buildMockPurchaseEntries(supplierId, year, month);
  },

  /**
   * Fetch all payments made to the supplier in a given month/year.
   * Replace body with: return apiClient.get(`/suppliers/${supplierId}/payments?month=${month}&year=${year}`)
   */
  async getMonthlyPayments(
    supplierId: string,
    month: number,
    year: number
  ): Promise<SupplierPaymentEntry[]> {
    await delay(200);
    return buildMockPayments(supplierId, year, month);
  },

  /**
   * Get the carried-over payable balance from the previous month.
   * Replace body with: return apiClient.get(`/suppliers/${supplierId}/balance?month=${month}&year=${year}`)
   */
  async getPreviousBalance(
    _supplierId: string,
    _month: number,
    _year: number
  ): Promise<number> {
    await delay(100);
    return 25000; // mock: we owe supplier Rs. 25,000 from last month
  },

  /**
   * Compute the full monthly summary.
   * This calls the individual methods; replace those instead of this one.
   */
  async getMonthlySummary(
    supplierId: string,
    month: number,
    year: number
  ): Promise<SupplierLedgerSummary> {
    const [entries, payments, prevBalance] = await Promise.all([
      this.getMonthlyPurchaseEntries(supplierId, month, year),
      this.getMonthlyPayments(supplierId, month, year),
      this.getPreviousBalance(supplierId, month, year),
    ]);

    const currentMonthAmount = entries.reduce((s, e) => s + e.amount, 0);
    const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
    const totalPayable = prevBalance + currentMonthAmount;
    const remaining = Math.max(0, totalPayable - totalPaid);

    return {
      currentMonthAmount,
      previousBalance: prevBalance,
      totalPayable,
      totalPaid,
      remaining,
    };
  },
};
