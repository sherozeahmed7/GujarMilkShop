import React, { useState } from 'react';
import { AuditInfoBanner } from '../components/audit/AuditInfoBanner';
import { ClosingReceiptCount } from '../components/audit/ClosingReceiptCount';
import { AuditResultPanel } from '../components/audit/AuditResultPanel';
import { PreviousAuditsPanel } from '../components/audit/PreviousAuditsPanel';
import { useAuditStore } from '../store/auditStore';
import { AuditRecord, AuditStatus } from '../types';

export const ReceiptAudit: React.FC = () => {
  const { getPosBillsForDate } = useAuditStore();
  const [previewRecord, setPreviewRecord] = useState<AuditRecord | null>(null);

  const handleRunAudit = async (date: string, receiptsText: string, notes: string) => {
    const rawPosBills = await getPosBillsForDate(date);

    // Normalize a receipt/bill string to its bare numeric ID
    // Strips prefixes like INV-, BILL-, #, leading zeros → "INV-00015" → "15"
    const normalize = (s: string) =>
      s.trim().replace(/^(INV-0*|BILL-0*|#|0+)/i, '').toUpperCase() || s.trim().toUpperCase();

    // Normalize POS bills from backend (numeric IDs → string)
    const posBills = rawPosBills.map(normalize);

    // Parse and normalize user-entered receipts
    const inputReceiptsRaw = receiptsText
      .split(/[\n, ]+/)
      .filter(r => r.trim().length > 0)
      .map(normalize);

    const uniqueReceipts = new Set<string>();
    const duplicates = new Set<string>();

    for (const r of inputReceiptsRaw) {
      if (uniqueReceipts.has(r)) {
        duplicates.add(r);
      } else {
        uniqueReceipts.add(r);
      }
    }

    const collectedArray = Array.from(uniqueReceipts);

    // Comparison
    const matched: string[] = [];
    const extra: string[] = [];
    const missing: string[] = [];
    const posSet = new Set(posBills);

    for (const r of collectedArray) {
      if (posSet.has(r)) matched.push(r);
      else extra.push(r);
    }

    for (const b of posBills) {
      if (!uniqueReceipts.has(b)) missing.push(b);
    }

    let status: AuditStatus = 'Matched';
    if (missing.length > 0 || extra.length > 0 || duplicates.size > 0) {
      status = (missing.length > 5 || extra.length > 5) ? 'Mismatch' : 'Warning';
    }

    const now = new Date().toISOString();
    const id = `AUDIT-${date.replace(/-/g, '')}-${Math.floor(Math.random() * 900 + 100)}`;

    const newRecord: AuditRecord = {
      id,
      auditDate: date,
      executedAt: now,
      totalPosBills: posBills.length,
      collectedReceipts: inputReceiptsRaw.length,
      matched,
      missing,
      extra,
      duplicates: Array.from(duplicates),
      status,
      notes,
      auditedBy: localStorage.getItem('userName') || 'User',
    };

    setPreviewRecord(newRecord);
  };

  const handleClearPreview = () => {
    setPreviewRecord(null);
  };

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      {/* Page Header */}
      <div className="flex items-start justify-between flex-shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">Receipt Audit</h1>
          <p className="text-slate-500 dark:text-[#64916e] text-sm mt-1">
            At closing, count the receipts kept by the item counter and compare them with POS bills.
          </p>
        </div>
        <div className="flex-1 flex justify-end min-w-0">
          <AuditInfoBanner />
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left: Input Panel */}
        <div className="w-[45%] flex-shrink-0 min-h-0 flex flex-col overflow-hidden">
          <ClosingReceiptCount onRunAudit={handleRunAudit} />
        </div>

        {/* Right: Results and History */}
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-hidden">
           {/* Top Right: Audit Result */}
           <div className="flex-[0.5] min-h-[350px] flex flex-col overflow-hidden">
             <AuditResultPanel 
                previewRecord={previewRecord} 
                onSave={handleClearPreview}
                onCancel={handleClearPreview} 
             />
           </div>

           {/* Bottom Right: Previous Audits */}
           <div className="flex-[0.5] min-h-[250px] flex flex-col overflow-hidden">
             <PreviousAuditsPanel />
           </div>
        </div>
      </div>
    </div>
  );
};
