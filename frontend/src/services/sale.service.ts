import { apiClient } from './apiClient';

export interface SaleItemPayload {
  itemName: 'milk' | 'yogurt' | 'lassi' | 'butter' | 'ghee';
  quantity: number;
  unitPrice: number;
}

export interface CreateSalePayload {
  saleType: 'walk_in' | 'split' | 'ledger_daily' | 'ledger_monthly';
  items: SaleItemPayload[];
  totalAmount: number;
  paidAmount?: number;
  discountAmount?: number;
  paymentMethod?: 'cash' | 'online';
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
  checkoutUuid?: string;
}

export interface SaleItem {
  id: number;
  saleId: number;
  itemName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: string;
}

export interface SalePayment {
  id: number;
  saleId: number;
  method: string;
  amount: number;
  status: string;
  createdAt: string;
}

export interface SaleRecord {
  id: number;
  saleType: string;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  /** Present when API includes customer relation */
  customer?: { id: number; name: string; phone?: string | null } | null;
  totalAmount: number;
  paidAmount: number;
  discountAmount?: number;
  remainingBalance: number;
  status: string;
  tokenNumber?: number;
  createdAt: string;
  updatedAt: string;
  items?: SaleItem[];
  payments?: SalePayment[];
}

export interface SalesReportSummary {
  netSales: number;
  cashSales: number;
  onlineSales: number;
  splitSales: number;
  totalBills: number;
}

export interface SalesChartPoint {
  label: string;
  value: number;
}

export interface SalesPaymentMixPoint {
  name: string;
  amount: number;
  value: number;
}

export interface SalesCategoryPoint {
  label: string;
  amount: number;
  value: number;
}

export interface SalesReportAnalytics {
  summary: SalesReportSummary;
  trend: SalesChartPoint[];
  paymentMethods: SalesPaymentMixPoint[];
  categoryBreakdown: SalesCategoryPoint[];
}

export interface SalesReportResponse {
  sales: SaleRecord[];
  analytics: SalesReportAnalytics;
}

/** @deprecated use SaleRecord */
export type SaleListItem = SaleRecord;

export const saleService = {
  /**
   * POST /api/sales
   */
  createSale: async (payload: CreateSalePayload): Promise<SaleRecord> => {
    const response = await apiClient.post('/sales', payload);
    return response.data as SaleRecord;
  },

  /**
   * GET /api/sales
   */
  listSales: async (filters?: {
    saleType?: string;
    status?: string;
    customerId?: number;
    phone?: string;
    fromDate?: string;
    toDate?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<SaleRecord[]> => {
    const params: Record<string, string | number> = {};
    if (filters?.saleType) params.saleType = filters.saleType;
    if (filters?.status) params.status = filters.status;
    if (filters?.customerId) params.customerId = filters.customerId;
    if (filters?.phone?.trim()) params.phone = filters.phone.trim();
    if (filters?.fromDate) params.fromDate = filters.fromDate;
    if (filters?.toDate) params.toDate = filters.toDate;
    if (filters?.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters?.dateTo) params.dateTo = filters.dateTo;
    if (filters?.page !== undefined) params.page = filters.page;
    if (filters?.limit !== undefined) params.limit = filters.limit;

    const response = await apiClient.get(
      '/sales',
      Object.keys(params).length ? params : undefined
    );
    // Support paginated backend response structure { data, pagination }
    return ((response as any).pagination ? (response.data || []) : (response.data || [])) as SaleRecord[];
  },

  /**
   * GET /api/sales?includeAnalytics=true — sales list + report aggregates
   */
  getSalesReport: async (filters: {
    fromDate: string;
    toDate: string;
  }): Promise<SalesReportResponse> => {
    const response = await apiClient.get('/sales', {
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      includeAnalytics: 'true',
    });
    return response.data as SalesReportResponse;
  },

  /**
   * GET /api/reports/f2-sales
   * Fetches real F2 Sales Report from SQLite backend
   */
  getF2SalesReport: async (filters: {
    fromDate: string;
    toDate: string;
  }): Promise<SalesReportResponse> => {
    const response = await apiClient.get('/reports/f2-sales', {
      from: filters.fromDate,
      to: filters.toDate,
    });
    return response.data as SalesReportResponse;
  },

  /**
   * GET /api/sales/:id
   */
  getSale: async (id: number): Promise<SaleRecord> => {
    const response = await apiClient.get(`/sales/${id}`);
    return response.data as SaleRecord;
  },

  /**
   * POST /api/sales/:id/settle — clear remaining on a split sale
   */
  settleSale: async (
    id: number,
    paymentMethod: 'cash' | 'online',
    amount?: number
  ): Promise<SaleRecord> => {
    const response = await apiClient.post(`/sales/${id}/settle`, {
      paymentMethod,
      ...(amount !== undefined ? { amount } : {}),
    });
    return response.data as SaleRecord;
  },
};
