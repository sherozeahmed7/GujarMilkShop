import { create } from 'zustand';
import { AuditRecord } from '../types';
import { mockPosBills, initialPastAudits } from '../data/auditMockData';

interface AuditStore {
  pastAudits: AuditRecord[];
  getPosBillsForDate: (dateStr: string) => string[]; // dateStr format: YYYY-MM-DD
  saveAudit: (record: AuditRecord) => void;
}

export const useAuditStore = create<AuditStore>((set) => ({
  pastAudits: initialPastAudits,

  getPosBillsForDate: (dateStr: string) => {
    return mockPosBills
      .filter((bill) => bill.date === dateStr)
      .map((bill) => bill.billNumber);
  },

  saveAudit: (record: AuditRecord) => {
    set((state) => ({
      pastAudits: [record, ...state.pastAudits],
    }));
  },
}));
