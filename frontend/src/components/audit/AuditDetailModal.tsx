import React from 'react';
import { X, Calendar, ClipboardList } from 'lucide-react';
import { AuditRecord, AuditStatus } from '../../types';

interface AuditDetailModalProps {
  record: AuditRecord;
  onClose: () => void;
}

const statusColors: Record<AuditStatus, string> = {
  Matched: 'bg-emerald-100 text-emerald-700',
  Warning: 'bg-amber-100 text-amber-700',
  Mismatch: 'bg-rose-100 text-rose-700',
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ record, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0">
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-[#64916e] uppercase tracking-wider">Audit Details</p>
            <h2 className="text-base font-bold text-slate-800 dark:text-[#e2f5e8] mt-0.5">{record.id}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 dark:text-[#64916e]" />
              <span className="font-bold text-slate-700 dark:text-[#a7c4ae]">Date Audited: {record.auditDate}</span>
            </div>
            <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${statusColors[record.status]}`}>
              {record.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-slate-50 dark:bg-[#142119] rounded-xl p-3 border border-slate-100 dark:border-[#2d4a35] text-center">
              <p className="text-[11px] font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">POS Bills</p>
              <p className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">{record.totalPosBills}</p>
            </div>
             <div className="bg-slate-50 dark:bg-[#142119] rounded-xl p-3 border border-slate-100 dark:border-[#2d4a35] text-center">
              <p className="text-[11px] font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Receipts</p>
              <p className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">{record.collectedReceipts}</p>
            </div>
          </div>

          {record.notes && (
            <div className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1 text-slate-500 dark:text-[#8ba895]">
                <ClipboardList className="w-3.5 h-3.5" />
                <p className="text-[11px] font-bold uppercase tracking-wider">Notes</p>
              </div>
              <p className="text-sm text-slate-700 dark:text-[#a7c4ae]">{record.notes}</p>
            </div>
          )}

          <div className="space-y-3">
             {record.missing.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-rose-600 uppercase tracking-wider mb-1">Missing ({record.missing.length})</p>
                  <p className="text-sm text-slate-700 dark:text-[#a7c4ae] font-mono bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 p-2 rounded-lg">
                    {record.missing.join(', ')}
                  </p>
                </div>
             )}
             {record.extra.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Extra ({record.extra.length})</p>
                  <p className="text-sm text-slate-700 dark:text-[#a7c4ae] font-mono bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 p-2 rounded-lg">
                    {record.extra.join(', ')}
                  </p>
                </div>
             )}
             {record.duplicates.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Duplicates ({record.duplicates.length})</p>
                  <p className="text-sm text-slate-700 dark:text-[#a7c4ae] font-mono bg-purple-50 dark:bg-purple-950/30 border border-purple-100 dark:border-purple-900/40 p-2 rounded-lg">
                    {record.duplicates.join(', ')}
                  </p>
                </div>
             )}
          </div>
          
          <div className="text-xs text-slate-400 dark:text-[#64916e] mt-4 text-center">
            Executed by {record.auditedBy} at {formatTimestamp(record.executedAt)}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-[#2d4a35] flex gap-3 flex-shrink-0">
           <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
