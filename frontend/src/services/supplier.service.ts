import { apiClient } from './apiClient';
import { Supplier, MilkCollection, SupplierPayment } from '../types';

const mapSupplier = (supplier: any): Supplier => ({ ...supplier, id: String(supplier.id) });
const mapCollection = (collection: any): MilkCollection => ({ ...collection, id: String(collection.id), supplierId: String(collection.supplierId) });
const mapPayment = (payment: any): SupplierPayment => ({ ...payment, id: String(payment.id), supplierId: String(payment.supplierId) });

export const supplierService = {
  async list(filters?: {
    cycleType?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<Supplier[]> {
    const params: Record<string, string> = {};
    if (filters?.cycleType) params.cycleType = filters.cycleType;
    if (filters?.fromDate) params.fromDate = filters.fromDate;
    if (filters?.toDate) params.toDate = filters.toDate;
    const response = await apiClient.get(
      '/suppliers',
      Object.keys(params).length ? params : undefined
    );
    return (response.data || []).map(mapSupplier);
  },
  async create(payload: Omit<Supplier, 'id' | 'payableBalance'>): Promise<Supplier> { const response = await apiClient.post('/suppliers', payload); return mapSupplier(response.data); },
  async update(id: string, payload: Partial<Supplier>): Promise<Supplier> { const response = await apiClient.put(`/suppliers/${id}`, payload); return mapSupplier(response.data); },
  async entries(id: string): Promise<{ collections: MilkCollection[]; payments: SupplierPayment[] }> {
    const response = await apiClient.get(`/suppliers/${id}/entries`);
    return { collections: (response.data?.collections || []).map(mapCollection), payments: (response.data?.payments || []).map(mapPayment) };
  },
  async saveCollection(supplierId: string, data: Omit<MilkCollection, 'id'> & { id?: string }): Promise<MilkCollection> {
    const response = await apiClient.post(`/suppliers/${supplierId}/collections`, { ...data, ...(data.id ? { id: Number(data.id) } : {}) });
    return mapCollection(response.data);
  },
  async deleteCollection(id: string): Promise<void> { await apiClient.delete(`/suppliers/collections/${id}`); },
  async addPayment(
    supplierId: string,
    payment: Omit<SupplierPayment, 'id'> & { discount?: number }
  ): Promise<SupplierPayment> {
    const response = await apiClient.post(`/suppliers/${supplierId}/payments`, payment);
    const data = Array.isArray(response.data) ? response.data[0] : response.data;
    return mapPayment(data);
  },
};