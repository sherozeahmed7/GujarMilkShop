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
  receiptWidth: '58mm',
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
    // return (await apiClient.get('/settings/pos-config')).data;
    
    // Simulate network delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...mockConfig });
      }, 400);
    });
  },

  updatePOSConfig: async (payload: POSConfigData): Promise<POSConfigData> => {
    // return (await apiClient.put('/settings/pos-config', payload)).data;
    
    // Simulate network delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!payload.shopName.trim()) {
          reject(new Error('Shop Name is required'));
          return;
        }
        if (payload.taxRate < 0) {
          reject(new Error('Tax Rate cannot be negative'));
          return;
        }
        if (payload.maxDiscountPercent < 0 || payload.maxDiscountPercent > 100) {
          reject(new Error('Max Discount Percent must be between 0 and 100'));
          return;
        }
        
        mockConfig = { ...payload };
        resolve({ ...mockConfig });
      }, 600);
    });
  },
};
