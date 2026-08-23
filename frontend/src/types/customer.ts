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
  /** Present on list responses — sum of open remaining balances */
  totalDue?: number;
  lastSaleDate?: string | null;
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
  /** null = Not Available */
  balance: number | null;
  /** ISO date or null */
  lastSaleDate: string | null;
  status?: string;
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
