import { apiClient } from './apiClient';
import { ApiCustomer } from '../types/customer';

export interface HeldCartItem {
  id: string;
  name: string;
  quantity: number;
  unit: 'kg' | 'rs';
  total: number;
  pricePerKg: number;
}

export interface HeldCartSnapshot {
  cart: HeldCartItem[];
  discount: number;
  paymentMethod: 'cash' | 'online' | 'split' | 'khata';
  splitPaidAmount: string;
  customerName: string;
  customerPhone: string;
  selectedKhataCustomer: ApiCustomer | null;
}

export interface HeldCartRecord {
  id: number;
  createdAt: string;
  snapshot: HeldCartSnapshot;
}

export const heldCartService = {
  create: async (snapshot: HeldCartSnapshot): Promise<HeldCartRecord> => {
    const response = await apiClient.post('/held-carts', snapshot);
    return response.data as HeldCartRecord;
  },

  list: async (): Promise<HeldCartRecord[]> => {
    const response = await apiClient.get('/held-carts');
    return (response.data || []) as HeldCartRecord[];
  },

  resume: async (id: number): Promise<HeldCartRecord> => {
    const response = await apiClient.post(`/held-carts/${id}/resume`);
    return response.data as HeldCartRecord;
  },

  remove: async (id: number): Promise<void> => {
    await apiClient.delete(`/held-carts/${id}`);
  },
};
