import { apiClient } from './apiClient';

export interface StandardPriceBox {
  weight: number;
  label: string;
  price: number;
}

export interface StandardAmountBox {
  amount: number;
  label: string;
  weight: number;
}

export interface StandardPrices {
  milkRatePerKg: number;
  yogurtRatePerKg: number;
  lastUpdated: string | null;
  milk: StandardPriceBox[];
  yogurtByWeight: StandardPriceBox[];
  yogurtByAmount: StandardAmountBox[];
}

export interface RateHistoryEntry {
  id: number;
  milkRate: number;
  yogurtRate: number;
  updatedByRole: string;
  date: string;
  createdAt: string;
}

export interface RatesData {
  history: RateHistoryEntry[];
  currentMilkRate: number;
  currentYogurtRate: number;
  lastUpdated: string | null;
}

export interface UpdateRatesPayload {
  milkRate: number;
  yogurtRate: number;
  date: string; // YYYY-MM-DD or ISO date
}

/**
 * Daily rates + standard price boxes API helpers.
 */
export const rateService = {
  /**
   * GET /api/rates/standard-prices
   */
  getStandardPrices: async (): Promise<StandardPrices> => {
    const response = await apiClient.get('/rates/standard-prices');
    return response.data as StandardPrices;
  },

  /**
   * GET /api/rates — current rates + full history
   */
  getRates: async (): Promise<RatesData> => {
    const response = await apiClient.get('/rates');
    return response.data as RatesData;
  },

  /**
   * POST /api/rates — create a new rate entry (any authenticated role)
   */
  updateRates: async (payload: UpdateRatesPayload): Promise<RateHistoryEntry> => {
    const response = await apiClient.post('/rates', payload);
    return response.data as RateHistoryEntry;
  },
};
