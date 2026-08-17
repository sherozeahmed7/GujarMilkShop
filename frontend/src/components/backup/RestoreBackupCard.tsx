import React, { useState } from 'react';
import { RotateCcw, X, Database, Loader2, AlertTriangle } from 'lucide-react';
import { BackupRecord } from '../../types';
import { useBackupStore } from '../../store/backupStore';
import { restoreBackup } from '../../services/backupService';

interface RestoreBackupCardProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  return 'just now';
}

export const RestoreBackupCard: React.FC<RestoreBackupCardProps> = ({ onSuccess, onError }) => {
  const { backups } = useBackupStore();
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const handleRestoreClick = () => {
    setShowSelectModal(true);
  };

  const handleSelect = (b: BackupRecord) => {
    setSelectedBackup(b);
    setShowSelectModal(false);
    setShowConfirm(true);
  };

  const handleConfirmRestore = async () => {
    if (!selectedBackup) return;
    setIsRestoring(true);
    try {
      await restoreBackup(selectedBackup);
      setIsRestoring(false);
      setShowConfirm(false);
      onSuccess(`Restore complete: ${selectedBackup.filename}`);
    } catch {
      setIsRestoring(false);
      setShowConfirm(false);
      onError('Restore failed. Please try again.');
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
            <RotateCcw className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Restore Backup</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Restore only when data is damaged or moving to another PC. The app creates a safety backup first.
            </p>
          </div>
        </div>
        <button
          onClick={handleRestoreClick}
          className="w-full flex items-center justify-center gap-2 py-3 bg-rose-500 hover:bg-rose-600 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
        >
          <AlertTriangle className="w-4 h-4" />
          Restore From Backup File
        </button>
      </div>

      {/* Select Modal */}
      {showSelectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowSelectModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">Select Backup to Restore</h2>
              <button onClick={() => setShowSelectModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {backups.slice(0, 15).map((b) => (
                <button
                  key={b.id}
                  onClick={() => handleSelect(b)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors flex items-start gap-3"
                >
                  <Database className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{b.filename}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatRelativeTime(b.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirm && selectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isRestoring && setShowConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
            <div className="p-6 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Confirm Restore</h3>
              <p className="text-sm text-slate-500">
                Restoring will replace all current data with the contents of:
              </p>
              <p className="text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 w-full text-left break-all">
                {selectedBackup.filename}
              </p>
              <p className="text-xs text-slate-400">A safety backup will be created first.</p>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={handleConfirmRestore}
                disabled={isRestoring}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white text-sm font-bold rounded-xl transition-all"
              >
                {isRestoring ? <><Loader2 className="w-4 h-4 animate-spin" />Restoring...</> : 'Yes, Restore Now'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isRestoring}
                className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
