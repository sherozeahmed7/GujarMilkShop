/**
 * Returns service — calls real /api/returns backend.
 */
import { MockBill, ReturnRecord } from '../types';
import { apiClient } from './apiClient';

export const getReturns = async (filters?: {
  fromDate?: string;
  toDate?: string;
  customerId?: number;
  saleIds?: number[];
}): Promise<ReturnRecord[]> => {
  const params: Record<string, string> = {};
  if (filters?.fromDate) params.fromDate = filters.fromDate;
  if (filters?.toDate) params.toDate = filters.toDate;
  if (filters?.customerId) params.customerId = String(filters.customerId);
  if (filters?.saleIds?.length) params.saleIds = filters.saleIds.join(',');
  const res = await apiClient.get('/returns', Object.keys(params).length ? params : undefined);
  return (res.data ?? []) as ReturnRecord[];
};

export const lookupBill = async (billNumber: string): Promise<MockBill | null> => {
  try {
    const res = await apiClient.get(`/returns/bill/${billNumber}`);
    return res.data as MockBill;
  } catch {
    return null;
  }
};

export const createReturn = async (
  data: Omit<ReturnRecord, 'returnId'> & { returnId?: string }
): Promise<ReturnRecord> => {
  const res = await apiClient.post('/returns', data);
  return res.data as ReturnRecord;
};
