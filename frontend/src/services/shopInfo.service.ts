// import { apiClient } from './apiClient';

export interface ShopInfoData {
  businessName: string;
  tagline: string;
  ownerName: string;
  businessType: string;
  
  primaryPhone: string;
  secondaryPhone: string;
  emailAddress: string;
  website: string;
  
  addressLine1: string;
  addressLine2: string;
  city: string;
  zipCode: string;
}

// Mock initial data
let mockShopInfo: ShopInfoData = {
  businessName: 'Gujar Milk Shop',
  tagline: 'Fresh & Pure Daily',
  ownerName: 'Ali Raza',
  businessType: 'Retail',
  
  primaryPhone: '0300-1234567',
  secondaryPhone: '',
  emailAddress: 'info@gujarmilk.com',
  website: '',
  
  addressLine1: 'Main Market, Block C',
  addressLine2: 'Near Central Park',
  city: 'Lahore',
  zipCode: '54000',
};

export const shopInfoService = {
  getShopInfo: async (): Promise<ShopInfoData> => {
    // return (await apiClient.get('/settings/shop-info')).data;
    
    // Simulate network delay
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ ...mockShopInfo });
      }, 400);
    });
  },

  updateShopInfo: async (payload: ShopInfoData): Promise<ShopInfoData> => {
    // return (await apiClient.put('/settings/shop-info', payload)).data;
    
    // Simulate network delay
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!payload.businessName.trim()) {
          reject(new Error('Business Name is required'));
          return;
        }
        if (!payload.primaryPhone.trim()) {
          reject(new Error('Primary Phone is required'));
          return;
        }
        
        mockShopInfo = { ...payload };
        resolve({ ...mockShopInfo });
      }, 600);
    });
  },
};
