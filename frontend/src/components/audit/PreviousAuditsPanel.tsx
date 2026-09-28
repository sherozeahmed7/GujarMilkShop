import React, { useState, useEffect } from 'react';
import { History, Eye } from 'lucide-react';
import { AuditRecord, AuditStatus } from '../../types';
import { useAuditStore } from '../../store/auditStore';
import { AuditDetailModal } from './AuditDetailModal';

const statusColors: Record<AuditStatus, string> = {
  Matched: 'bg-emerald-100 text-emerald-700',
  Warning: 'bg-amber-100 text-amber-700',
  Mismatch: 'bg-rose-100 text-rose-700',
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

export const PreviousAuditsPanel: React.FC = () => {
  const { pastAudits, fetchAudits } = useAuditStore();
  const [viewRecord, setViewRecord] = useState<AuditRecord | null>(null);

  useEffect(() => { fetchAudits(); }, []);

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-100 dark:border-[#2d4a35] shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500 dark:text-[#86efac]" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] uppercase tracking-wider">Previous Audits</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-[#2d4a35]">
        {pastAudits.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400 font-medium">
            No saved audits yet.
          </div>
        )}

        {pastAudits.map((record) => (
          <div key={record.id} className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-[#223927] transition-colors flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-bold text-sm text-slate-800 dark:text-[#e2f5e8]">{record.auditDate}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[record.status]}`}>
                  {record.status}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                <span>POS: {record.totalPosBills}</span>
                <span>Scanned: {record.collectedReceipts}</span>
                <span>Diff: {Math.abs(record.totalPosBills - record.collectedReceipts)}</span>
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Ran on {formatTimestamp(record.executedAt)}
              </div>
            </div>
            <button
              onClick={() => setViewRecord(record)}
              className="p-2 hover:bg-slate-200 dark:hover:bg-[#2d4a35] rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-[#e2f5e8] transition-colors flex-shrink-0"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {viewRecord && (
        <AuditDetailModal 
          record={viewRecord} 
          onClose={() => setViewRecord(null)} 
        />
      )}
    </div>
  );
};
