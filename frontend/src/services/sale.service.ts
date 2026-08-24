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
  paymentMethod?: 'cash' | 'online';
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
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
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: string;
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

    const response = await apiClient.get(
      '/sales',
      Object.keys(params).length ? params : undefined
    );
    return (response.data || []) as SaleRecord[];
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
   * GET /api/sales?f2Only=true
   * Mock implementation for F2 Sales Report
   */
  getF2SalesReport: async (filters: {
    fromDate: string;
    toDate: string;
  }): Promise<SalesReportResponse> => {
    // MOCK DATA for F2 Sales Report
    // TODO: Replace with actual API integration later
    const MOCK_F2_SALES: SaleRecord[] = [
      {
        id: 1001,
        saleType: 'walk_in',
        customerId: null,
        customerName: 'Walk-in',
        customerPhone: null,
        totalAmount: 1500,
        paidAmount: 1500,
        remainingBalance: 0,
        status: 'completed',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          { id: 1, saleId: 1001, itemName: 'Lassi', quantity: 2, unitPrice: 200, totalPrice: 400, createdAt: new Date().toISOString() },
          { id: 2, saleId: 1001, itemName: 'Butter', quantity: 1, unitPrice: 1100, totalPrice: 1100, createdAt: new Date().toISOString() }
        ],
        payments: [{ id: 1, saleId: 1001, method: 'cash', amount: 1500, status: 'completed', createdAt: new Date().toISOString() }]
      },
      {
        id: 1002,
        saleType: 'split',
        customerId: 5,
        customerName: 'Ali Raza',
        customerPhone: '03001234567',
        totalAmount: 2200,
        paidAmount: 1000,
        remainingBalance: 1200,
        status: 'partial',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          { id: 3, saleId: 1002, itemName: 'Ghee', quantity: 1, unitPrice: 2200, totalPrice: 2200, createdAt: new Date().toISOString() }
        ],
        payments: [{ id: 2, saleId: 1002, method: 'cash', amount: 1000, status: 'completed', createdAt: new Date().toISOString() }]
      },
      {
        id: 1003,
        saleType: 'ledger_daily',
        customerId: 8,
        customerName: 'Usman',
        customerPhone: null,
        totalAmount: 600,
        paidAmount: 0,
        remainingBalance: 600,
        status: 'pending',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        updatedAt: new Date().toISOString(),
        items: [
          { id: 4, saleId: 1003, itemName: 'Lassi', quantity: 3, unitPrice: 200, totalPrice: 600, createdAt: new Date().toISOString() }
        ],
        payments: []
      }
    ];

    const allSales = MOCK_F2_SALES;
    const f2Sales = allSales.filter(sale => 
      sale.items?.some(item => ['Lassi', 'Butter', 'Ghee'].includes(item.itemName))
    );

    // Calculate F2 specific analytics
    let netSales = 0;
    let lassiSold = 0;
    let butterSold = 0;
    let gheeSold = 0;
    let cashSales = 0;
    let creditSales = 0;

    const trendMap: Record<string, number> = {};

    f2Sales.forEach(sale => {
      // Calculate totals only for F2 items within the bill
      let f2TotalForSale = 0;
      sale.items?.forEach(item => {
        if (['Lassi', 'Butter', 'Ghee'].includes(item.itemName)) {
          f2TotalForSale += item.totalPrice;
          if (item.itemName === 'Lassi') lassiSold += item.quantity;
          if (item.itemName === 'Butter') butterSold += item.quantity;
          if (item.itemName === 'Ghee') gheeSold += item.quantity;
        }
      });

      netSales += f2TotalForSale;
      
      const isCredit = sale.saleType === 'split' || sale.saleType.startsWith('ledger_');
      if (isCredit) {
        creditSales += f2TotalForSale;
      } else {
        cashSales += f2TotalForSale;
      }

      const dateStr = new Date(sale.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      trendMap[dateStr] = (trendMap[dateStr] || 0) + f2TotalForSale;
    });

    const trend = Object.keys(trendMap).map(label => ({
      label,
      value: trendMap[label]
    }));

    const categoryBreakdown = [];
    if (lassiSold > 0) categoryBreakdown.push({ label: 'Lassi', amount: lassiSold, value: lassiSold });
    if (butterSold > 0) categoryBreakdown.push({ label: 'Butter', amount: butterSold, value: butterSold });
    if (gheeSold > 0) categoryBreakdown.push({ label: 'Ghee', amount: gheeSold, value: gheeSold });

    const totalCategorySales = lassiSold + butterSold + gheeSold;
    if (totalCategorySales > 0) {
      categoryBreakdown.forEach(c => {
        c.value = Math.round((c.amount / totalCategorySales) * 100);
      });
    }

    return {
      sales: f2Sales,
      analytics: {
        summary: {
          netSales,
          cashSales,
          onlineSales: 0,
          splitSales: creditSales,
          totalBills: f2Sales.length,
        },
        trend,
        paymentMethods: [],
        categoryBreakdown
      }
    };
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
