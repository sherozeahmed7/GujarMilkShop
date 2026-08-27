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
  Matched: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  Warning: 'text-amber-700 bg-amber-50 border-amber-200',
  Mismatch: 'text-rose-700 bg-rose-50 border-rose-200',
};

export const AuditResultPanel: React.FC<AuditResultPanelProps> = ({ previewRecord, onSave, onCancel }) => {
  const { saveAudit } = useAuditStore();

  if (!previewRecord) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex-1 flex flex-col items-center justify-center min-h-[300px]">
        <HelpCircle className="w-10 h-10 text-slate-300 mb-3" />
        <h3 className="text-slate-800 font-bold">No audit preview yet</h3>
        <p className="text-slate-500 text-sm mt-1">Enter receipts and click Run Audit.</p>
      </div>
    );
  }

  const handleSave = async () => {
    await saveAudit(previewRecord);
    onSave();
  };

  const hasIssues = previewRecord.status !== 'Matched';

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Audit Result</h2>
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
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total POS Bills</p>
            <p className="text-2xl font-bold text-slate-800">{previewRecord.totalPosBills}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Collected Receipts</p>
            <p className="text-2xl font-bold text-slate-800">{previewRecord.collectedReceipts}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
            <p className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Matched</p>
            <p className="text-2xl font-bold text-emerald-700">{previewRecord.matched.length}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Difference</p>
            <p className="text-2xl font-bold text-slate-800">
              {Math.abs(previewRecord.totalPosBills - previewRecord.collectedReceipts)}
            </p>
          </div>
        </div>

        {/* Details lists */}
        {hasIssues && (
          <div className="space-y-3 mt-2">
            {previewRecord.missing.length > 0 && (
              <div className="border border-rose-200 rounded-xl overflow-hidden">
                <div className="bg-rose-50 px-3 py-2 border-b border-rose-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-rose-700 uppercase tracking-wider">Missing (No physical receipt)</span>
                  <span className="text-xs font-bold bg-rose-200 text-rose-800 px-2 py-0.5 rounded-full">{previewRecord.missing.length}</span>
                </div>
                <div className="p-3 text-sm text-slate-700 font-mono bg-white">
                  {previewRecord.missing.join(', ')}
                </div>
              </div>
            )}
            
            {previewRecord.extra.length > 0 && (
              <div className="border border-amber-200 rounded-xl overflow-hidden">
                <div className="bg-amber-50 px-3 py-2 border-b border-amber-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Extra (Not in POS)</span>
                  <span className="text-xs font-bold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">{previewRecord.extra.length}</span>
                </div>
                <div className="p-3 text-sm text-slate-700 font-mono bg-white">
                  {previewRecord.extra.join(', ')}
                </div>
              </div>
            )}

            {previewRecord.duplicates.length > 0 && (
              <div className="border border-purple-200 rounded-xl overflow-hidden">
                <div className="bg-purple-50 px-3 py-2 border-b border-purple-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Duplicates Scanned</span>
                  <span className="text-xs font-bold bg-purple-200 text-purple-800 px-2 py-0.5 rounded-full">{previewRecord.duplicates.length}</span>
                </div>
                <div className="p-3 text-sm text-slate-700 font-mono bg-white">
                  {previewRecord.duplicates.join(', ')}
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Footer Buttons */}
      <div className="p-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
        <button
          onClick={handleSave}
          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
        >
          Save Audit
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold rounded-xl transition-all"
        >
          Discard
        </button>
      </div>
    </div>
  );
};
