/** Registered ledger customer from GET/POST /api/customers */
export interface ApiCustomer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  customerType: 'daily_ledger' | 'monthly_ledger';
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  /** Seeded / edited opening dues */
  openingBalance?: number;
  /** Open remaining in current period (today / this month) — billed amount */
  currentDue?: number;
  /** Billed amount from before current period */
  previousDue?: number;
  /** currentDue + previousDue (total billed) */
  totalAmount?: number;
  /** Sum of payments received */
  paidAmount?: number;
  /** Still outstanding */
  remainingBalance?: number;
  /** Alias of remainingBalance (open dues) */
  totalDue?: number;
  lastSaleDate?: string | null;
  customMilkRate?: number | null;
}

export type CustomerRowKind = 'ledger' | 'walk_in' | 'split';

/**
 * Normalized row for the Customers table (ledger account OR walk-in/split sale).
 */
export interface CustomerTableRow {
  key: string;
  kind: CustomerRowKind;
  /** Ledger customer id, walk-in sale id, or first split sale id in group */
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  /** Display label for Type column */
  typeLabel: string;
  customerType?: 'daily_ledger' | 'monthly_ledger';
  /** Billed in current period; null = N/A (walk-in) */
  currentDue: number | null;
  /** Billed before current period; null = N/A */
  previousDue: number | null;
  /** Total billed (current + previous) */
  totalAmount: number | null;
  /** Amount already paid/collected */
  paidAmount: number | null;
  /** Remaining outstanding (legacy alias: balance) */
  balance: number | null;
  /** ISO date or null */
  lastSaleDate: string | null;
  status?: string;
  customMilkRate?: number | null;
  /** cash | online | Split | Not Available */
  paymentType: string | null;
  /** For split groups — all sale ids in the group */
  saleIds?: number[];
}

/** @deprecated mock-era shape — kept for Khata Ledger mock store until that page is migrated */
export interface Customer {
  id: string;
  name: string;
  phone: string;
  cardNumber: string;
  address: string;
  notes: string;
  balance: number;
  lastSaleDate: string | null;
}

export type KhataTransactionType = 'Opening Balance' | 'Credit Sale' | 'Payment';

export interface KhataTransaction {
  id: string;
  customerId: string;
  date: string;
  type: KhataTransactionType;
  amount: number;
  description: string;
  method?: string;
}
