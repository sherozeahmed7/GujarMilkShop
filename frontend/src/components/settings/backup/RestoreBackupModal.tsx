import React, { useState } from 'react';
import { X, AlertTriangle, RotateCcw } from 'lucide-react';
import { BackupRecord } from '../../../types';
import { useBackupStore } from '../../../store/backupStore';
import { restoreBackup } from '../../../services/backupService';
import { toast } from 'react-hot-toast';

interface RestoreBackupModalProps {
  backup: BackupRecord;
  onClose: () => void;
}

export const RestoreBackupModal: React.FC<RestoreBackupModalProps> = ({ backup, onClose }) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const { loadInitialData } = useBackupStore();

  const handleRestore = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      toast.loading('Validating and restoring backup...', { id: 'restore-toast' });
      await restoreBackup(backup.filename);
      // Refresh backup list after restore (new safety backup may appear)
      await loadInitialData();
      toast.success(
        'Backup restored successfully! Please restart the application to apply all changes.',
        { id: 'restore-toast', duration: 8000 }
      );
      onClose();
    } catch (error: any) {
      const msg = error?.message || 'Failed to restore backup.';
      toast.error(msg, { id: 'restore-toast', duration: 8000 });
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0">
          <div className="flex items-center gap-2 text-emerald-600">
            <RotateCcw className="w-5 h-5" />
            <h2 className="text-lg font-bold">Restore Backup</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isRestoring}
            className="p-2 text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-slate-600 dark:text-[#a7c4ae] text-sm mb-4">
            A safety backup of your current database will be created automatically before the restore begins.
          </p>

          <div className="bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl p-4 mb-4 break-all text-sm font-medium text-slate-800 dark:text-[#e2f5e8]">
            {backup.filename}
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium">
              This will replace the current database with the selected backup. The source file will be validated before any changes are made.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-[#a7c4ae] hover:text-slate-800 dark:hover:text-[#e2f5e8] hover:bg-slate-200 dark:hover:bg-[#1e3124] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleRestore}
            disabled={isRestoring}
            className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRestoring ? 'Restoring...' : 'Confirm Restore'}
          </button>
        </div>
      </div>
    </div>
  );
};
