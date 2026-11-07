import { apiClient } from './apiClient';
import { ApiCustomer } from '../types/customer';

export interface CreateCustomerPayload {
  name: string;
  phone?: string;
  address?: string;
  customerType: 'daily_ledger' | 'monthly_ledger';
  /** Optional existing dues — shows in Previous column */
  openingBalance?: number;
  customMilkRate?: number | null;
}

export interface UpdateCustomerPayload {
  name?: string;
  phone?: string;
  address?: string;
  customerType?: 'daily_ledger' | 'monthly_ledger';
  openingBalance?: number;
  customMilkRate?: number | null;
}

export interface CustomerListFilters {
  status?: string;
  customerType?: string;
  search?: string;
  /** When true, only customers with open dues (legacy) */
  dues?: boolean;
  /** pending | paid | all — Paid/Pending filter for Khata Ledger */
  duesStatus?: 'pending' | 'paid' | 'all';
  fromDate?: string;
  toDate?: string;
}

export interface CustomerSummaryStats {
  totalRows: number;
  totalOutstanding: number;
  withDues: number;
}

export interface LedgerSummaryStats {
  khataAccounts: number;
  totalOutstanding: number;
  collectedToday: number;
  pendingCount: number;
  paidCount: number;
  supplierAccounts?: number;
  supplierPayables?: number;
  supplierPaid?: number;
}

export interface CollectedBreakdownEntry {
  customerId: number;
  customerName: string;
  phone: string | null;
  address: string | null;
  customerType: string;
  totalPaid: number;
  lastPaymentDate: string | null;
  paymentCount: number;
}

export const customerService = {
  /**
   * GET /api/customers/summary — Customers screen (mixed ledger + walk-in + split)
   */
  getSummary: async (): Promise<CustomerSummaryStats> => {
    const response = await apiClient.get('/customers/summary');
    return response.data as CustomerSummaryStats;
  },

  /**
   * GET /api/customers/summary?scope=ledger — Khata Ledger cards
   */
  getLedgerSummary: async (fromDate?: string, toDate?: string): Promise<LedgerSummaryStats> => {
    const params: Record<string, string> = { scope: 'ledger' };
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    const response = await apiClient.get('/customers/summary', params);
    return response.data as LedgerSummaryStats;
  },

  /**
   * GET /api/customers?search=&dues=&duesStatus=&customerType=&status=
   */
  getCustomer: async (id: number | string): Promise<ApiCustomer> => {
    const response = await apiClient.get('/customers/' + id);
    return response.data as ApiCustomer;
  },

  getCustomers: async (filters?: CustomerListFilters): Promise<ApiCustomer[]> => {
    const params: Record<string, string> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.customerType) params.customerType = filters.customerType;
    if (filters?.search?.trim()) params.search = filters.search.trim();
    if (filters?.dues) params.dues = 'true';
    if (filters?.duesStatus) params.duesStatus = filters.duesStatus;
    if (filters?.fromDate) params.fromDate = filters.fromDate;
    if (filters?.toDate) params.toDate = filters.toDate;

    const response = await apiClient.get(
      '/customers',
      Object.keys(params).length ? params : undefined
    );
    return (response.data || []) as ApiCustomer[];
  },

  /**
   * POST /api/customers
   */
  createCustomer: async (payload: CreateCustomerPayload): Promise<ApiCustomer> => {
    const response = await apiClient.post('/customers', payload);
    return response.data as ApiCustomer;
  },

  /**
   * PUT /api/customers/:id
   */
  updateCustomer: async (
    id: number,
    payload: UpdateCustomerPayload
  ): Promise<ApiCustomer> => {
    const response = await apiClient.put(`/customers/${id}`, payload);
    return response.data as ApiCustomer;
  },

  /**
   * DELETE /api/customers/:id — soft delete (inactive)
   */
  deleteCustomer: async (id: number): Promise<ApiCustomer> => {
    const response = await apiClient.delete(`/customers/${id}`);
    return response.data as ApiCustomer;
  },

  /**
   * PATCH /api/customers/:id/status — Activate / Deactivate
   */
  updateStatus: async (id: number, status: 'active' | 'inactive'): Promise<ApiCustomer> => {
    const response = await apiClient.patch(`/customers/${id}/status`, { status });
    return response.data as ApiCustomer;
  },

  /**
   * POST /api/customers/:id/settle-all — clear all ledger dues
   */
  settleAll: async (
    id: number,
    paymentMethod: 'cash' | 'online',
    amount?: number,
    discount?: number
  ): Promise<unknown> => {
    const response = await apiClient.post(`/customers/${id}/settle-all`, {
      paymentMethod,
      ...(amount !== undefined ? { amount } : {}),
      ...(discount !== undefined && discount > 0 ? { discount } : {}),
    });
    return response.data;
  },

  /**
   * GET /api/customers/collected-breakdown — per-customer payment totals for a date range.
   */
  getCollectedBreakdown: async (fromDate?: string, toDate?: string): Promise<CollectedBreakdownEntry[]> => {
    const params: Record<string, string> = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    const response = await apiClient.get('/customers/collected-breakdown', Object.keys(params).length ? params : undefined);
    return (response.data || []) as CollectedBreakdownEntry[];
  },
};
