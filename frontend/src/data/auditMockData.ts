import { AuditRecord, PosBillSummary } from '../types';

export const mockPosBills: PosBillSummary[] = [
  // Today's bills
  { billNumber: 'BILL-0001', date: '2026-08-17' },
  { billNumber: 'BILL-0002', date: '2026-08-17' },
  { billNumber: 'BILL-0003', date: '2026-08-17' },
  { billNumber: 'BILL-0004', date: '2026-08-17' },
  { billNumber: 'BILL-0005', date: '2026-08-17' },
  { billNumber: 'BILL-0006', date: '2026-08-17' },
  { billNumber: 'BILL-0007', date: '2026-08-17' },
  { billNumber: 'BILL-0008', date: '2026-08-17' },
  // Yesterday's bills
  { billNumber: 'BILL-9001', date: '2026-08-16' },
  { billNumber: 'BILL-9002', date: '2026-08-16' },
  { billNumber: 'BILL-9003', date: '2026-08-16' },
];

export const initialPastAudits: AuditRecord[] = [
  {
    id: 'AUDIT-20260816',
    auditDate: '2026-08-16',
    executedAt: '2026-08-16T23:30:00+05:00',
    totalPosBills: 3,
    collectedReceipts: 3,
    matched: ['BILL-9001', 'BILL-9002', 'BILL-9003'],
    missing: [],
    extra: [],
    duplicates: [],
    status: 'Matched',
    notes: 'All receipts matched successfully.',
    auditedBy: 'System Admin',
  },
  {
    id: 'AUDIT-20260815',
    auditDate: '2026-08-15',
    executedAt: '2026-08-15T23:45:00+05:00',
    totalPosBills: 45,
    collectedReceipts: 44,
    matched: ['BILL-8001', '... (43 more)'],
    missing: ['BILL-8012'],
    extra: [],
    duplicates: [],
    status: 'Warning',
    notes: 'One missing receipt. Checked with delivery, likely lost in transit.',
    auditedBy: 'System Admin',
  },
];
