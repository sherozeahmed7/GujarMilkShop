import { apiClient } from './apiClient';
import { ApiCustomer } from '../types/customer';

export interface CreateCustomerPayload {
  name: string;
  phone?: string;
  address?: string;
  customerType: 'daily_ledger' | 'monthly_ledger';
}

export interface UpdateCustomerPayload {
  name?: string;
  phone?: string;
  address?: string;
  customerType?: 'daily_ledger' | 'monthly_ledger';
}

export interface CustomerListFilters {
  status?: string;
  customerType?: string;
  search?: string;
  /** When true, only customers with open dues */
  dues?: boolean;
}

export interface CustomerSummaryStats {
  totalRows: number;
  totalOutstanding: number;
  withDues: number;
}

export const customerService = {
  /**
   * GET /api/customers/summary
   */
  getSummary: async (): Promise<CustomerSummaryStats> => {
    const response = await apiClient.get('/customers/summary');
    return response.data as CustomerSummaryStats;
  },

  /**
   * GET /api/customers?search=&dues=&customerType=&status=
   */
  getCustomers: async (filters?: CustomerListFilters): Promise<ApiCustomer[]> => {
    const params: Record<string, string> = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.customerType) params.customerType = filters.customerType;
    if (filters?.search?.trim()) params.search = filters.search.trim();
    if (filters?.dues) params.dues = 'true';

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
   * POST /api/customers/:id/settle-all — clear all ledger dues
   */
  settleAll: async (
    id: number,
    paymentMethod: 'cash' | 'online'
  ): Promise<unknown> => {
    const response = await apiClient.post(`/customers/${id}/settle-all`, {
      paymentMethod,
    });
    return response.data;
  },
};
