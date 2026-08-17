import React, { useState, useCallback } from 'react';
import { ManualBackupCard } from '../components/backup/ManualBackupCard';
import { RestoreBackupCard } from '../components/backup/RestoreBackupCard';
import { StorageLocationCard } from '../components/backup/StorageLocationCard';
import { BackupHistoryPanel } from '../components/backup/BackupHistoryPanel';
import { Toast, ToastType } from '../components/backup/Toast';

interface ToastState {
  type: ToastType;
  message: string;
}

export const Backup: React.FC = () => {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((type: ToastType, message: string) => {
    setToast({ type, message });
  }, []);

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      {/* Page Header */}
      <div className="flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Backup & Restore</h1>
        <p className="text-slate-500 text-sm mt-1">Protect your data with regular backups and easy restoration.</p>
      </div>

      {/* Main two-column layout */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* LEFT column */}
        <div className="w-[340px] flex-shrink-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar pb-4">
          <ManualBackupCard
            onSuccess={(msg) => showToast('success', msg)}
            onError={(msg) => showToast('error', msg)}
          />
          <RestoreBackupCard
            onSuccess={(msg) => showToast('success', msg)}
            onError={(msg) => showToast('error', msg)}
          />
          <StorageLocationCard
            onInfo={(msg) => showToast('info', msg)}
          />
        </div>

        {/* RIGHT column */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <BackupHistoryPanel />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  );
};
