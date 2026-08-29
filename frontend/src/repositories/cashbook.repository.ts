/**
 * ICashbookRepository — interface for the Cashbook data layer.
 *
 * The current implementation is a mock (localStorage).
 * To connect to a real backend, create a new class that implements
 * this interface using real API calls and swap it in cashbook.service.ts.
 * React components do NOT need to be rebuilt.
 */
import {
  CashPerson,
  CashbookTransaction,
  CashPersonLedgerEntry,
  CashbookSummary,
  CreateCashPersonPayload,
  AddTransactionPayload,
  CashbookTransactionFilters,
} from '../types/cashbook';

export interface ICashbookRepository {
  /** Fetch all cash persons (all statuses). */
  getCashPersons(): Promise<CashPerson[]>;

  /** Fetch a single cash person by ID. */
  getCashPersonById(id: string): Promise<CashPerson | undefined>;

  /** Create a new cash person (auto-creates Opening Balance transaction). */
  createCashPerson(data: CreateCashPersonPayload): Promise<CashPerson>;

  /** Update mutable fields on an existing cash person. */
  updateCashPerson(id: string, data: Partial<CashPerson>): Promise<CashPerson>;

  /** Soft-disable a cash person (keeps all history). */
  disableCashPerson(id: string): Promise<CashPerson>;

  /** Re-enable a previously disabled cash person. */
  enableCashPerson(id: string): Promise<CashPerson>;

  /**
   * Fetch all transactions for a specific cash person,
   * with running balance applied, sorted oldest → newest.
   */
  getCashPersonLedger(personId: string): Promise<CashPersonLedgerEntry[]>;

  /**
   * Record a new Receive Amount or Pay Amount transaction.
   * Updates person's internal balance state.
   */
  addCashbookTransaction(data: AddTransactionPayload): Promise<CashbookTransaction>;

  /** Fetch all transactions with optional filters. */
  getCashbookTransactions(filters?: CashbookTransactionFilters): Promise<CashbookTransaction[]>;

  /**
   * Returns aggregate summary (informational only).
   * These values MUST NOT be used in P&L or Cash Register calculations.
   */
  getCashbookSummary(): Promise<CashbookSummary>;
}
