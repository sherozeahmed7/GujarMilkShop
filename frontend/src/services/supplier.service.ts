import { apiClient } from './apiClient';
import { Supplier, MilkCollection, SupplierPayment, SupplierPaymentRecord } from '../types';

const mapSupplier = (supplier: any): Supplier => ({ ...supplier, id: String(supplier.id) });
const mapCollection = (collection: any): MilkCollection => ({ ...collection, id: String(collection.id), supplierId: String(collection.supplierId) });
const mapPayment = (payment: any): SupplierPayment => ({
  ...payment,
  id: String(payment.id),
  supplierId: String(payment.supplierId),
  shiftId: payment.shiftId ?? null,
  shiftDate: payment.shiftDate ?? null,
  shiftStatus: payment.shiftStatus ?? null,
});

const mapPaymentRecord = (row: any): SupplierPaymentRecord => ({
  id: String(row.id),
  supplierId: String(row.supplierId),
  supplierName: row.supplierName || '—',
  supplierCode: row.supplierCode || '',
  date: row.date,
  amount: Number(row.amount) || 0,
  method: row.method || 'cash',
  notes: row.notes ?? null,
  createdAt: row.createdAt,
  createdBy: row.createdBy ?? null,
  shiftId: row.shiftId ?? null,
  shiftDate: row.shiftDate ?? null,
  shiftStatus: row.shiftStatus ?? null,
  shiftOpenedAt: row.shiftOpenedAt ?? null,
  shiftClosedAt: row.shiftClosedAt ?? null,
});

export const supplierService = {
  async list(filters?: {
    cycleType?: string;
    fromDate?: string;
    toDate?: string;
    isActive?: boolean;
  }): Promise<Supplier[]> {
    const params: Record<string, string> = {};
    if (filters?.cycleType) params.cycleType = filters.cycleType;
    if (filters?.fromDate) params.fromDate = filters.fromDate;
    if (filters?.toDate) params.toDate = filters.toDate;
    if (filters?.isActive !== undefined) params.isActive = String(filters.isActive);
    const response = await apiClient.get(
      '/suppliers',
      Object.keys(params).length ? params : undefined
    );
    return (response.data || []).map(mapSupplier);
  },
  async listPayments(filters?: {
    fromDate?: string;
    toDate?: string;
    supplierId?: string;
    shiftId?: string | number;
    shiftDate?: string;
    method?: string;
  }): Promise<SupplierPaymentRecord[]> {
    const params: Record<string, string> = {};
    if (filters?.fromDate) params.fromDate = filters.fromDate;
    if (filters?.toDate) params.toDate = filters.toDate;
    if (filters?.supplierId) params.supplierId = String(filters.supplierId);
    if (filters?.shiftId != null && filters.shiftId !== '') params.shiftId = String(filters.shiftId);
    if (filters?.shiftDate) params.shiftDate = filters.shiftDate;
    if (filters?.method && filters.method !== 'all') params.method = filters.method;
    const response = await apiClient.get(
      '/suppliers/payments',
      Object.keys(params).length ? params : undefined
    );
    return (response.data || []).map(mapPaymentRecord);
  },
  async getNextCode(): Promise<string> {
    const response = await apiClient.get('/suppliers/next-code');
    return response.data?.code || '';
  },
  async create(payload: Omit<Supplier, 'id' | 'payableBalance' | 'code'> & { code?: string; openingBalance?: number }): Promise<Supplier> { const response = await apiClient.post('/suppliers', payload); return mapSupplier(response.data); },
  async update(id: string, payload: Partial<Supplier>): Promise<Supplier> { const response = await apiClient.put(`/suppliers/${id}`, payload); return mapSupplier(response.data); },
  async toggleActive(id: string, isActive: boolean): Promise<Supplier> {
    const response = await apiClient.put(`/suppliers/${id}`, { isActive });
    return mapSupplier(response.data);
  },
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
    payment: Omit<SupplierPayment, 'id'> & { discount?: number; clientUuid?: string }
  ): Promise<SupplierPayment> {
    const response = await apiClient.post(`/suppliers/${supplierId}/payments`, payment);
    const data = Array.isArray(response.data) ? response.data[0] : response.data;
    return mapPayment(data);
  },
};