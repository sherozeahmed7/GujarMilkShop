/**
 * Cashbook Service — Backend API Implementation
 *
 * Implements ICashbookRepository using backend REST endpoints.
 *
 * ACCOUNTING ISOLATION:
 * This service is 100% independent from:
 *   - POS / Sales
 *   - Cash Register balances
 *   - Customer / Supplier Ledger
 *   - Inventory
 *   - Expenses
 *   - Profit & Loss calculations
 * Cashbook values are INFORMATIONAL ONLY.
 */
import { ICashbookRepository } from '../repositories/cashbook.repository';
import {
  CashPerson,
  CashbookTransaction,
  CashPersonLedgerEntry,
  CashbookSummary,
  CreateCashPersonPayload,
  AddTransactionPayload,
  CashbookTransactionFilters,
} from '../types/cashbook';
import { activityLogger } from './activityLogger';
import { apiClient } from './apiClient';

class CashbookApiService implements ICashbookRepository {
  async getCashPersons(): Promise<CashPerson[]> {
    const res = await apiClient.get('/cashbook/persons');
    return res.data || [];
  }

  async getCashPersonById(id: string): Promise<CashPerson | undefined> {
    try {
      const res = await apiClient.get(`/cashbook/persons/${id}`);
      return res.data;
    } catch {
      return undefined;
    }
  }

  async createCashPerson(data: CreateCashPersonPayload): Promise<CashPerson> {
    const res = await apiClient.post('/cashbook/persons', data);
    const person = res.data;

    activityLogger.log({
      action: 'Cash Person Created',
      module: 'Cashbook',
      description: `Created cash person "${person.name}" (${person.type}, ${person.customerType}) with opening balance Rs. ${data.openingBalance.toLocaleString()}`,
      entityId: String(person.id),
      status: 'Success',
    });

    return person;
  }

  async updateCashPerson(id: string, data: Partial<CashPerson>): Promise<CashPerson> {
    const res = await apiClient.put(`/cashbook/persons/${id}`, data);
    return res.data;
  }

  async disableCashPerson(id: string): Promise<CashPerson> {
    const res = await apiClient.patch(`/cashbook/persons/${id}/status`, {});
    const person = res.data;
    activityLogger.log({
      action: 'Cash Person Disabled',
      module: 'Cashbook',
      description: `Disabled cash person "${person.name}". Historical records preserved.`,
      entityId: String(id),
      status: 'Warning',
    });
    return person;
  }

  async enableCashPerson(id: string): Promise<CashPerson> {
    const res = await apiClient.patch(`/cashbook/persons/${id}/status`, {});
    const person = res.data;
    activityLogger.log({
      action: 'Cash Person Enabled',
      module: 'Cashbook',
      description: `Re-enabled cash person "${person.name}".`,
      entityId: String(id),
      status: 'Success',
    });
    return person;
  }

  async getCashPersonLedger(personId: string): Promise<CashPersonLedgerEntry[]> {
    const res = await apiClient.get(`/cashbook/persons/${personId}/ledger`);
    return res.data || [];
  }

  async addCashbookTransaction(data: AddTransactionPayload): Promise<CashbookTransaction> {
    const res = await apiClient.post('/cashbook/transactions', data);
    const txn = res.data;

    activityLogger.log({
      action: data.transactionType === 'Receive Amount' ? 'Amount Received' : 'Amount Paid',
      module: 'Cashbook',
      description: `${data.transactionType} of Rs. ${data.amount.toLocaleString()} for person #${data.cashPersonId}${data.description ? ` — ${data.description}` : ''}`,
      entityId: String(txn.id),
      status: 'Success',
    });

    return txn;
  }

  async getCashbookTransactions(filters?: CashbookTransactionFilters): Promise<CashbookTransaction[]> {
    const params: Record<string, any> = {};
    if (filters?.personId) params.personId = filters.personId;
    if (filters?.type && filters.type !== 'All') params.type = filters.type;
    if (filters?.dateRange) params.dateRange = filters.dateRange;
    if (filters?.fromDate) params.fromDate = filters.fromDate;
    if (filters?.toDate) params.toDate = filters.toDate;

    const res = await apiClient.get('/cashbook/transactions', params);
    return res.data || [];
  }

  async getCashbookSummary(): Promise<CashbookSummary> {
    const res = await apiClient.get('/cashbook/summary');
    return res.data || {
      totalToReceive: 0,
      totalToPay: 0,
      totalReceived: 0,
      totalPaid: 0,
      activeCashPersons: 0,
      netBalance: 0,
    };
  }
}

/** Singleton service instance connected to the real backend database API. */
export const cashbookService: ICashbookRepository = new CashbookApiService();

/** Convenience re-export of individual service methods for direct import. */
export const getCashPersons = () => cashbookService.getCashPersons();
export const getCashPersonById = (id: string) => cashbookService.getCashPersonById(id);
export const createCashPerson = (data: CreateCashPersonPayload) => cashbookService.createCashPerson(data);
export const updateCashPerson = (id: string, data: Partial<CashPerson>) => cashbookService.updateCashPerson(id, data);
export const disableCashPerson = (id: string) => cashbookService.disableCashPerson(id);
export const enableCashPerson = (id: string) => cashbookService.enableCashPerson(id);
export const getCashPersonLedger = (id: string) => cashbookService.getCashPersonLedger(id);
export const addCashbookTransaction = (data: AddTransactionPayload) => cashbookService.addCashbookTransaction(data);
export const getCashbookTransactions = (filters?: CashbookTransactionFilters) => cashbookService.getCashbookTransactions(filters);
export const getCashbookSummary = () => cashbookService.getCashbookSummary();
