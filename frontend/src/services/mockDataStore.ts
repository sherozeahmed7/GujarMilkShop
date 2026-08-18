/**
 * CENTRAL MOCK DATA STORE
 * ========================
 * Single source of truth for ALL reports.
 * All API methods read from here so Sales, P&L, Cash Register,
 * Expenses, Returns, Shifts, and Activity Logs all agree.
 *
 * To connect a real backend: replace `getMockDataStore()` calls in
 * each service file with real API fetch calls. No UI changes required.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SaleTransaction {
  id: string;
  date: string;
  time: string;
  customer: string;
  customerId: string;
  paymentMethod: 'Cash' | 'Credit' | 'Online';
  items: number;
  category: string;
  gross: number;
  discount: number;
  net: number;
  costOfGoods: number;
  cashier: string;
  shiftId: string;
  status: 'Completed' | 'Voided';
}

export interface ReturnTransaction {
  id: string;
  date: string;
  originalSaleId: string;
  customer: string;
  items: number;
  amount: number;
  refundMethod: 'Cash' | 'Credit Adjustment';
  reason: string;
  category: string;
  createdBy: string;
  status: 'Processed';
}

export interface ExpenseEntry {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: 'Cash' | 'Bank Transfer';
  addedBy: string;
  notes: string;
  status: 'Paid';
}

export interface ShiftRecord {
  id: string;
  date: string;
  openTime: string;
  closeTime: string;
  openedBy: string;
  closedBy: string;
  openingCash: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  cashExpenses: number;
  cashRefunds: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
  durationHours: number;
  status: 'Closed' | 'Open';
}

export interface CashRegisterEntry {
  id: string;
  date: string;
  shiftId: string;
  cashier: string;
  openingCash: number;
  cashSales: number;
  cashIn: number;
  cashOut: number;
  expenses: number;
  refunds: number;
  expectedCash: number;
  countedCash: number;
  variance: number;
  closingCash: number;
  status: 'Balanced' | 'Variance';
}

export interface BackupRecord {
  id: string;
  fileName: string;
  date: string;
  time: string;
  size: string;
  sizeBytes: number;
  type: 'Full' | 'Incremental';
  location: 'Local Storage' | 'Cloud';
  createdBy: string;
  duration: string;
  status: 'Success' | 'Failed';
}

export interface MockDataStore {
  sales: SaleTransaction[];
  returns: ReturnTransaction[];
  expenses: ExpenseEntry[];
  shifts: ShiftRecord[];
  cashRegister: CashRegisterEntry[];
  backups: BackupRecord[];
}

// ─── Deterministic RNG (seeded so data is stable per session) ─────────────────

let _seed = 12345;
function rand(): number {
  _seed = (_seed * 1664525 + 1013904223) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function rInt(min: number, max: number) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick<T>(arr: readonly T[]): T { return arr[rInt(0, arr.length - 1)]; }

// ─── Constants ────────────────────────────────────────────────────────────────

const CASHIERS = ['System Admin', 'Ali Tariq', 'Ahmed Raza'] as const;
const CUSTOMERS = [
  { name: 'Ali Raza', id: 'CUST-1' },
  { name: 'Muhammad Aslam', id: 'CUST-2' },
  { name: 'Tahir Hussain', id: 'CUST-3' },
  { name: 'Ahmed Khan', id: 'CUST-4' },
  { name: 'Walk-in Customer', id: 'CUST-WALKIN' },
  { name: 'Naseem Akhtar', id: 'CUST-5' },
  { name: 'Bilal Chaudhry', id: 'CUST-6' },
] as const;
const CATEGORIES = ['Milk', 'Yogurt', 'Butter', 'Cream', 'Other'] as const;
const EXPENSE_CATS = ['Utilities', 'Salaries', 'Rent', 'Maintenance', 'Marketing', 'Supplies'] as const;
const RETURN_REASONS = ['Sour / Spoiled', 'Wrong Item', 'Customer Changed Mind', 'Damaged Packaging', 'Overcharged', 'Duplicate Bill'] as const;

// ─── Day-level data generator ─────────────────────────────────────────────────

function buildDayData(dayDate: Date, dayIdx: number) {
  const dateStr = dayDate.toISOString().split('T')[0];
  const shiftId = `SHF-${String(dayIdx + 1).padStart(3, '0')}`;
  const cashier = pick(CASHIERS);

  // Sales
  const salesCount = rInt(15, 50);
  const sales: SaleTransaction[] = [];
  let totalCashSales = 0;

  for (let i = 0; i < salesCount; i++) {
    const customer = pick(CUSTOMERS);
    const gross = rInt(300, 3500);
    const discount = rand() > 0.75 ? Math.round(gross * 0.05) : 0;
    const net = gross - discount;
    const cog = Math.round(net * 0.64); // 64% COGS margin
    const pm: SaleTransaction['paymentMethod'] = rand() > 0.65 ? (rand() > 0.5 ? 'Credit' : 'Online') : 'Cash';
    if (pm === 'Cash') totalCashSales += net;
    const h = rInt(8, 21);
    const m = rInt(0, 59);
    sales.push({
      id: `INV-${dayIdx * 200 + i + 10000}`,
      date: dateStr,
      time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      customer: customer.name,
      customerId: customer.id,
      paymentMethod: pm,
      items: rInt(1, 6),
      category: pick(CATEGORIES),
      gross,
      discount,
      net,
      costOfGoods: cog,
      cashier,
      shiftId,
      status: rand() > 0.98 ? 'Voided' : 'Completed',
    });
  }

  // Returns (0–2 per day)
  const returnCount = rand() > 0.55 ? rInt(0, 2) : 0;
  const returns: ReturnTransaction[] = [];
  let cashRefunds = 0;

  for (let i = 0; i < returnCount; i++) {
    const rm: ReturnTransaction['refundMethod'] = rand() > 0.45 ? 'Cash' : 'Credit Adjustment';
    const amount = rInt(200, 1200);
    if (rm === 'Cash') cashRefunds += amount;
    returns.push({
      id: `RET-${String(dayIdx * 10 + i + 1).padStart(4, '0')}`,
      date: dateStr,
      originalSaleId: `INV-${dayIdx * 200 + rInt(10000, 10050)}`,
      customer: pick(CUSTOMERS).name,
      items: rInt(1, 3),
      amount,
      refundMethod: rm,
      reason: pick(RETURN_REASONS),
      category: pick(CATEGORIES),
      createdBy: cashier,
      status: 'Processed',
    });
  }

  // Expenses (0–3 per day)
  const expCount = rand() > 0.5 ? rInt(1, 3) : 0;
  const expenses: ExpenseEntry[] = [];
  let cashExpenses = 0;

  for (let i = 0; i < expCount; i++) {
    const cat = pick(EXPENSE_CATS);
    const amount = rInt(500, 8000);
    const pm: ExpenseEntry['paymentMethod'] = rand() > 0.45 ? 'Cash' : 'Bank Transfer';
    if (pm === 'Cash') cashExpenses += amount;
    expenses.push({
      id: `EXP-${String(dayIdx * 10 + i + 1).padStart(4, '0')}`,
      date: dateStr,
      category: cat,
      description: `${cat} — ${dateStr}`,
      amount,
      paymentMethod: pm,
      addedBy: cashier,
      notes: '',
      status: 'Paid',
    });
  }

  // Cash register (derived from actual day's data)
  const openingCash = 5000;
  const cashIn = rInt(200, 1000); // manual cash top-ups
  const cashOut = rInt(300, 1500); // petty cash withdrawals
  const expected = openingCash + totalCashSales + cashIn - cashOut - cashExpenses - cashRefunds;
  const variance = Math.round((rand() - 0.5) * 350);
  const counted = Math.max(0, expected + variance);

  const register: CashRegisterEntry = {
    id: `REG-${String(dayIdx + 1).padStart(3, '0')}`,
    date: dateStr,
    shiftId,
    cashier,
    openingCash,
    cashSales: totalCashSales,
    cashIn,
    cashOut,
    expenses: cashExpenses,
    refunds: cashRefunds,
    expectedCash: Math.max(0, expected),
    countedCash: counted,
    variance,
    closingCash: counted,
    status: Math.abs(variance) < 250 ? 'Balanced' : 'Variance',
  };

  // Shift record
  const openH = 7, closeH = 22;
  const openTime = new Date(dayDate); openTime.setHours(openH, 0, 0, 0);
  const closeTime = new Date(dayDate); closeTime.setHours(closeH, 0, 0, 0);
  const shift: ShiftRecord = {
    id: shiftId,
    date: dateStr,
    openTime: openTime.toISOString(),
    closeTime: closeTime.toISOString(),
    openedBy: cashier,
    closedBy: cashier,
    openingCash,
    cashSales: totalCashSales,
    cashIn,
    cashOut,
    cashExpenses,
    cashRefunds,
    expectedCash: Math.max(0, expected),
    countedCash: counted,
    variance,
    durationHours: closeH - openH,
    status: 'Closed',
  };

  return { sales, returns, expenses, register, shift };
}

// ─── Singleton store ──────────────────────────────────────────────────────────

let _store: MockDataStore | null = null;

export function getMockDataStore(): MockDataStore {
  if (_store) return _store;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const allSales: SaleTransaction[] = [];
  const allReturns: ReturnTransaction[] = [];
  const allExpenses: ExpenseEntry[] = [];
  const allShifts: ShiftRecord[] = [];
  const allRegister: CashRegisterEntry[] = [];

  // 90 days of linked data
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const { sales, returns, expenses, register, shift } = buildDayData(d, 89 - i);
    allSales.push(...sales);
    allReturns.push(...returns);
    allExpenses.push(...expenses);
    allRegister.push(register);
    allShifts.push(shift);
  }

  // Backups (independent)
  const backups: BackupRecord[] = Array.from({ length: 15 }).map((_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - i * 2);
    const isSuccess = rand() > 0.1;
    const sizeBytes = rInt(40, 250) * 1024 * 1024;
    return {
      id: `BCK-${String(i + 1).padStart(3, '0')}`,
      fileName: `gujar_pos_backup_${d.toISOString().split('T')[0]}.db`,
      date: d.toISOString().split('T')[0],
      time: `${String(rInt(0, 23)).padStart(2, '0')}:${String(rInt(0, 59)).padStart(2, '0')}`,
      size: `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`,
      sizeBytes,
      type: i % 3 === 0 ? 'Full' : 'Incremental',
      location: i % 2 === 0 ? 'Local Storage' : 'Cloud',
      createdBy: 'System (Auto)',
      duration: `${rInt(8, 90)}s`,
      status: isSuccess ? 'Success' : 'Failed',
    };
  });

  _store = {
    sales: allSales.sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    returns: allReturns.sort((a, b) => b.date.localeCompare(a.date)),
    expenses: allExpenses.sort((a, b) => b.date.localeCompare(a.date)),
    shifts: allShifts.sort((a, b) => b.date.localeCompare(a.date)),
    cashRegister: allRegister.sort((a, b) => b.date.localeCompare(a.date)),
    backups,
  };

  return _store;
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function filterByDateRange<T extends { date: string }>(
  items: T[],
  start: Date | null | undefined,
  end: Date | null | undefined,
): T[] {
  if (!start || !end) return items;
  const s = start.toISOString().split('T')[0];
  const e = end.toISOString().split('T')[0];
  return items.filter(item => item.date >= s && item.date <= e);
}

/** Aggregate daily totals for trend charts */
export function toDailyTrend(
  items: { date: string; value: number }[]
): { label: string; value: number }[] {
  const map: Record<string, number> = {};
  items.forEach(({ date, value }) => {
    const label = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    map[label] = (map[label] || 0) + value;
  });
  return Object.entries(map).map(([label, value]) => ({ label, value }));
}
