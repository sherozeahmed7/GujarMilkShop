/**
 * Cashbook Module Types
 *
 * Cashbook is a standalone informational money-tracking module.
 * It does NOT affect POS, Inventory, Customer/Supplier Ledger,
 * Cash Register balance, Expenses, or Profit & Loss calculations.
 */

/** Whether this person/account represents money we EXPECT TO RECEIVE or EXPECT TO PAY. */
export type CashPersonType = 'Incoming' | 'Outgoing';

/**
 * Debtor  — this person owes US money (they will pay us).
 * Creditor — we owe THIS person money (we will pay them).
 */
export type CustomerType = 'Debtor' | 'Creditor';

export type CashPersonStatus = 'Active' | 'Disabled';

/** Cashbook transaction direction. */
export type TransactionType =
  | 'Opening Balance'
  | 'Receive Amount'
  | 'Pay Amount';

export interface CashPerson {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  /** Incoming = we expect to RECEIVE; Outgoing = we expect to PAY */
  type: CashPersonType;
  description?: string;
  openingBalance: number;
  /** Debtor = they owe us; Creditor = we owe them */
  customerType: CustomerType;
  status: CashPersonStatus;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

export interface CashbookTransaction {
  id: string;
  cashPersonId: string;
  cashPersonName: string; // denormalised for display
  transactionType: TransactionType;
  amount: number;
  description?: string;
  date: string; // YYYY-MM-DD
  createdBy: string;
  createdAt: string; // ISO
}

export interface CashPersonLedgerEntry {
  id: string;
  date: string;
  description: string;
  transactionType: TransactionType;
  amountIn: number;
  amountOut: number;
  runningBalance: number;
  createdBy: string;
}

export interface CashbookSummary {
  /** Total outstanding that others need to pay us */
  totalToReceive: number;
  /** Total outstanding that we need to pay others */
  totalToPay: number;
  /** Total amount received through cashbook transactions */
  totalReceived: number;
  /** Total amount paid through cashbook transactions */
  totalPaid: number;
  /** Count of Active cash persons */
  activeCashPersons: number;
  /** Informational net: totalToReceive - totalToPay */
  netBalance: number;
}

export interface CreateCashPersonPayload {
  name: string;
  phone?: string;
  address?: string;
  type: CashPersonType;
  description?: string;
  openingBalance: number;
  customerType: CustomerType;
}

export interface AddTransactionPayload {
  cashPersonId: string;
  transactionType: Exclude<TransactionType, 'Opening Balance'>;
  amount: number;
  description?: string;
  date: string;
}

export interface CashbookTransactionFilters {
  personId?: string;
  type?: 'All' | 'Incoming' | 'Outgoing' | 'Received' | 'Paid';
  dateRange?: 'Today' | 'This Week' | 'This Month' | 'Custom';
  fromDate?: string;
  toDate?: string;
}
