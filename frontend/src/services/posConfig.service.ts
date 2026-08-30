import { apiClient } from './apiClient';

export interface POSConfigData {
  // General POS Settings
  shopName: string;
  taxRate: number;
  currencySymbol: string;
  lowStockAlertThreshold: number;

  // Receipt Settings
  printReceiptAutomatically: boolean;
  showLogoOnReceipt: boolean;
  receiptFooterText: string;
  receiptWidth: '58mm' | '80mm';

  // Printer Settings
  printerEnabled: boolean;
  printerName: string;
  autoCutter: boolean;
  cashDrawer: boolean;

  // Sale Behaviour
  requireCustomerName: boolean;
  allowDiscount: boolean;
  maxDiscountPercent: number;
  defaultPaymentMethod: 'cash' | 'online' | 'split' | 'khata';

  // Display Preferences
  showDailyRateOnPOS: boolean;
  showCartSubtotal: boolean;
  confirmBeforeSale: boolean;
  autoClearCartAfterSale: boolean;
}

// Mock initial data
let mockConfig: POSConfigData = {
  shopName: 'Gujar Milk Shop',
  taxRate: 0,
  currencySymbol: 'Rs',
  lowStockAlertThreshold: 10,
  printReceiptAutomatically: true,
  showLogoOnReceipt: false,
  receiptFooterText: 'Thank you for your visit!',
  receiptWidth: '80mm',
  printerEnabled: true,
  printerName: 'Black Copper BC-105',
  autoCutter: true,
  cashDrawer: false,
  requireCustomerName: false,
  allowDiscount: true,
  maxDiscountPercent: 10,
  defaultPaymentMethod: 'cash',
  showDailyRateOnPOS: true,
  showCartSubtotal: true,
  confirmBeforeSale: false,
  autoClearCartAfterSale: true,
};

export const posConfigService = {
  getPOSConfig: async (): Promise<POSConfigData> => {
    try {
      const res = await apiClient.get('/pos-config');
      // If the backend wraps in `.data`, use it; otherwise assume `res` itself is the config.
      // If it's somehow undefined, fall back to mockConfig.
      const config = res.data || res;
      if (!config || typeof config !== 'object' || !config.shopName) {
        return { ...mockConfig };
      }
      return config;
    } catch {
      // Fall back to in-memory config when backend is unavailable
      return { ...mockConfig };
    }
  },

  updatePOSConfig: async (payload: POSConfigData): Promise<POSConfigData> => {
    try {
      const res = await apiClient.put('/pos-config', payload);
      return res.data || res || { ...mockConfig };
    } catch {
      // Persist locally when backend is unavailable
      mockConfig = { ...payload };
      return { ...mockConfig };
    }
  },
};
