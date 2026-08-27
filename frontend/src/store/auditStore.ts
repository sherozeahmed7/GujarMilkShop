import { create } from 'zustand';
import { AuditRecord, PosBillSummary } from '../types';
import * as auditApi from '../services/auditService';

interface AuditStore {
  pastAudits:  AuditRecord[];
  isLoading:   boolean;
  error:       string | null;

  fetchAudits:       () => Promise<void>;
  getPosBillsForDate:(date: string) => Promise<string[]>;
  saveAudit:         (record: AuditRecord) => Promise<void>;
  clearError:        () => void;
}

export const useAuditStore = create<AuditStore>((set) => ({
  pastAudits: [],
  isLoading:  false,
  error:      null,

  fetchAudits: async () => {
    set({ isLoading: true, error: null });
    try {
      const audits = await auditApi.getAudits();
      set({ pastAudits: audits, isLoading: false });
    } catch (err: any) {
      set({ error: err.message || 'Failed to fetch audits', isLoading: false });
    }
  },

  getPosBillsForDate: async (date: string): Promise<string[]> => {
    try {
      const bills: PosBillSummary[] = await auditApi.getBillsForDate(date);
      return bills.map((b) => b.billNumber);
    } catch {
      return [];
    }
  },

  saveAudit: async (record: AuditRecord) => {
    const saved = await auditApi.saveAudit(record);
    set((state) => ({ pastAudits: [saved, ...state.pastAudits] }));
  },

  clearError: () => set({ error: null }),
}));
