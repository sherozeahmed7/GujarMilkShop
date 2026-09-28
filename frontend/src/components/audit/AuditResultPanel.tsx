import React from 'react';
import { AlertCircle, CheckCircle2, FileWarning, HelpCircle } from 'lucide-react';
import { AuditRecord, AuditStatus } from '../../types';
import { useAuditStore } from '../../store/auditStore';

interface AuditResultPanelProps {
  previewRecord: AuditRecord | null;
  onSave: () => void;
  onCancel: () => void;
}

const StatusIcon = ({ status }: { status: AuditStatus }) => {
  switch (status) {
    case 'Matched':
      return <CheckCircle2 className="w-10 h-10 text-emerald-500 mb-2" />;
    case 'Warning':
      return <AlertCircle className="w-10 h-10 text-amber-500 mb-2" />;
    case 'Mismatch':
      return <FileWarning className="w-10 h-10 text-rose-500 mb-2" />;
  }
};

const statusColors: Record<AuditStatus, string> = {
  Matched: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/50',
  Warning: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/50',
  Mismatch: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/50',
};

export const AuditResultPanel: React.FC<AuditResultPanelProps> = ({ previewRecord, onSave, onCancel }) => {
  const { saveAudit } = useAuditStore();

  if (!previewRecord) {
    return (
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-100 dark:border-[#2d4a35] shadow-sm flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <HelpCircle className="w-10 h-10 text-slate-300 dark:text-slate-600 mb-3" />
        <h3 className="text-slate-800 dark:text-[#e2f5e8] font-bold">No audit preview yet</h3>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Enter receipts and click Run Audit.</p>
      </div>
    );
  }

  const handleSave = async () => {
    await saveAudit(previewRecord);
    onSave();
  };

  const hasIssues = previewRecord.status !== 'Matched';

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-100 dark:border-[#2d4a35] shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0">
        <h2 className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] uppercase tracking-wider">Audit Result</h2>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-4">
        {/* Status Header */}
        <div className={`border rounded-xl p-5 flex flex-col items-center text-center ${statusColors[previewRecord.status]}`}>
          <StatusIcon status={previewRecord.status} />
          <h3 className="font-bold text-lg mb-1">{previewRecord.status}</h3>
          <p className="text-sm opacity-90">
            {previewRecord.status === 'Matched' 
              ? 'All physical receipts match the POS bills.' 
              : 'Discrepancies found between physical receipts and POS bills.'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-3">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total POS Bills</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8]">{previewRecord.totalPosBills}</p>
          </div>
          <div className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-3">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Collected Receipts</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8]">{previewRecord.collectedReceipts}</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3">
            <p className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Matched</p>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{previewRecord.matched.length}</p>
          </div>
          <div className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-3">
            <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Difference</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8]">
              {Math.abs(previewRecord.totalPosBills - previewRecord.collectedReceipts)}
            </p>
          </div>
        </div>

        {/* Details lists */}
        {hasIssues && (
          <div className="space-y-3 mt-2">
            {previewRecord.missing.length > 0 && (
              <div className="border border-rose-200 dark:border-rose-800/50 rounded-xl overflow-hidden">
                <div className="bg-rose-50 dark:bg-rose-950/30 px-3 py-2 border-b border-rose-200 dark:border-rose-800/50 flex justify-between items-center">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider">Missing (No physical receipt)</span>
                  <span className="text-xs font-bold bg-rose-200 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-full">{previewRecord.missing.length}</span>
                </div>
                <div className="p-3 text-sm text-slate-700 dark:text-[#e2f5e8] font-mono bg-white dark:bg-[#142119]">
                  {previewRecord.missing.join(', ')}
                </div>
              </div>
            )}
            
            {previewRecord.extra.length > 0 && (
              <div className="border border-amber-200 dark:border-amber-800/50 rounded-xl overflow-hidden">
                <div className="bg-amber-50 dark:bg-amber-950/30 px-3 py-2 border-b border-amber-200 dark:border-amber-800/50 flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider">Extra (Not in POS)</span>
                  <span className="text-xs font-bold bg-amber-200 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full">{previewRecord.extra.length}</span>
                </div>
                <div className="p-3 text-sm text-slate-700 dark:text-[#e2f5e8] font-mono bg-white dark:bg-[#142119]">
                  {previewRecord.extra.join(', ')}
                </div>
              </div>
            )}

            {previewRecord.duplicates.length > 0 && (
              <div className="border border-purple-200 dark:border-purple-800/50 rounded-xl overflow-hidden">
                <div className="bg-purple-50 dark:bg-purple-950/30 px-3 py-2 border-b border-purple-200 dark:border-purple-800/50 flex justify-between items-center">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Duplicates Scanned</span>
                  <span className="text-xs font-bold bg-purple-200 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded-full">{previewRecord.duplicates.length}</span>
                </div>
                <div className="p-3 text-sm text-slate-700 dark:text-[#e2f5e8] font-mono bg-white dark:bg-[#142119]">
                  {previewRecord.duplicates.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Footer Buttons */}
      <div className="p-4 border-t border-slate-100 dark:border-[#2d4a35] flex gap-3 flex-shrink-0">
        <button
          onClick={handleSave}
          className="flex-1 py-2.5 bg-emerald-600 dark:bg-[#22c55e] hover:bg-emerald-700 dark:hover:bg-[#1ea34d] active:scale-95 text-white dark:text-[#0d1a10] text-sm font-bold rounded-xl shadow-sm transition-all"
        >
          Save Audit
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#223927] text-slate-600 dark:text-[#e2f5e8] text-sm font-semibold rounded-xl transition-all"
        >
          Discard
        </button>
      </div>
    </div>
  );
};
