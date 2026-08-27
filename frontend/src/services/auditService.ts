/**
 * Audit service — calls real /api/audits backend.
 */
import { AuditRecord, PosBillSummary } from '../types';
import { apiClient } from './apiClient';

export const getAudits = async (): Promise<AuditRecord[]> => {
  const res = await apiClient.get('/audits');
  return (res.data ?? []) as AuditRecord[];
};

export const saveAudit = async (record: AuditRecord): Promise<AuditRecord> => {
  const res = await apiClient.post('/audits', record);
  return res.data as AuditRecord;
};

export const getBillsForDate = async (date: string): Promise<PosBillSummary[]> => {
  const res = await apiClient.get('/audits/bills', { date });
  return (res.data ?? []) as PosBillSummary[];
};
