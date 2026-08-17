import React from 'react';
import { HardDrive, Loader2 } from 'lucide-react';
import { useBackupStore } from '../../store/backupStore';

interface ManualBackupCardProps {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export const ManualBackupCard: React.FC<ManualBackupCardProps> = ({ onSuccess, onError }) => {
  const { isCreating, createBackup } = useBackupStore();

  const handleCreate = async () => {
    try {
      const backup = await createBackup();
      onSuccess(`Backup created: ${backup.filename}`);
    } catch {
      onError('Failed to create backup. Please try again.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <HardDrive className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="font-bold text-slate-800">Manual Backup</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Create a copy of the full local database before closing shop, Windows repair, or moving to another PC.
          </p>
        </div>
      </div>
      <button
        onClick={handleCreate}
        disabled={isCreating}
        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white text-sm font-bold rounded-xl transition-all shadow-sm"
      >
        {isCreating ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating Backup...
          </>
        ) : (
          <>
            <HardDrive className="w-4 h-4" />
            Create Backup Now
          </>
        )}
      </button>
    </div>
  );
};
