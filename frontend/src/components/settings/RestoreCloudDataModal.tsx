import React, { useState } from 'react';
import { X, AlertTriangle, DownloadCloud, ShieldCheck, Database, CheckCircle2 } from 'lucide-react';
import { cloudSyncService } from '../../services/cloudSync.service';

interface RestoreCloudDataModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
  pendingCount: number;
  failedCount: number;
}

export const RestoreCloudDataModal: React.FC<RestoreCloudDataModalProps> = ({
  onClose,
  onSuccess,
  pendingCount,
  failedCount,
}) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restoreProgress, setRestoreProgress] = useState<string | null>(null);

  const hasUnsyncedItems = pendingCount > 0 || failedCount > 0;

  const handleRestore = async () => {
    if (hasUnsyncedItems) {
      setError(`Cannot restore cloud data. You have ${pendingCount + failedCount} pending/failed item(s) in the sync queue. Please sync or resolve them first.`);
      return;
    }

    setIsRestoring(true);
    setError(null);
    setRestoreProgress('Creating safe pre-restore SQLite backup...');

    try {
      setRestoreProgress('Downloading consistent cloud snapshot from Neon & restoring modules...');
      const result = await cloudSyncService.restoreCloudData();
      
      if (result.success) {
        onSuccess(`Successfully restored ${result.totalRestored} records from cloud backup. (Backup: ${result.backupPath})`);
        onClose();
      } else {
        setError(result.message || 'Failed to restore cloud data.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Failed to restore cloud data.');
    } finally {
      setIsRestoring(false);
      setRestoreProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0 bg-slate-50/50 dark:bg-[#142119]">
          <div className="flex items-center gap-2.5 text-blue-700">
            <div className="p-2 bg-blue-100 rounded-xl">
              <DownloadCloud className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Restore Cloud Data</h2>
              <p className="text-xs text-slate-500 dark:text-[#8ba895]">Neon PostgreSQL → Local SQLite</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRestoring}
            className="p-2 text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col gap-4">
          {error && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/30 text-rose-700 rounded-xl text-sm border border-rose-200 dark:border-rose-900/40 flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {hasUnsyncedItems ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 dark:text-amber-300">
                <p className="font-bold mb-1">Unsynced Local Data Detected</p>
                <p>
                  You have <strong>{pendingCount} pending</strong> and <strong>{failedCount} failed</strong> items in your local sync queue.
                  To prevent data loss, cloud restore is locked until all local changes reach the cloud.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-slate-600 dark:text-[#a7c4ae] text-sm leading-relaxed">
              This operation safely pulls a complete, consistent snapshot from your online Neon PostgreSQL database and reconciles it into your local POS SQLite database.
            </p>
          )}

          {/* Safety Checklist Box */}
          <div className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-4 flex flex-col gap-2.5">
            <div className="text-xs font-bold text-slate-600 dark:text-[#a7c4ae] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Safety Guarantees
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-[#a7c4ae]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>A crash-safe local SQLite backup is created before restore.</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-[#a7c4ae]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Existing relationships, ledger history, and IDs are preserved.</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-[#a7c4ae]">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Local database is never dropped or blindly truncated.</span>
            </div>
          </div>

          {isRestoring && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 rounded-xl flex items-center gap-3">
              <Database className="w-5 h-5 text-blue-600 animate-pulse flex-shrink-0" />
              <div className="text-xs text-blue-800 dark:text-blue-300 font-medium">
                {restoreProgress || 'Processing restore... Please do not close the application.'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119]">
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="px-4 py-2 text-sm font-medium bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124] rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleRestore}
            disabled={isRestoring || hasUnsyncedItems}
            className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isRestoring ? 'Restoring Cloud Data...' : 'Start Safe Restore'}
          </button>
        </div>
      </div>
    </div>
  );
};
