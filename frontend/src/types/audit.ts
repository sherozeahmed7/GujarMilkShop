export type AuditStatus = 'Matched' | 'Warning' | 'Mismatch';

export interface AuditRecord {
  id: string;
  auditDate: string; // The date of the shift being audited (YYYY-MM-DD)
  executedAt: string; // ISO timestamp when the audit was saved
  totalPosBills: number;
  collectedReceipts: number;
  matched: string[];
  missing: string[];
  extra: string[];
  duplicates: string[];
  status: AuditStatus;
  notes: string;
  auditedBy: string;
}

export interface PosBillSummary {
  billNumber: string;
  date: string; // YYYY-MM-DD
}
