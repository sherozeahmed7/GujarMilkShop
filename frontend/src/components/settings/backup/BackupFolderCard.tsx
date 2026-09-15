import React from 'react';
import { Folder } from 'lucide-react';
import { useBackupStore } from '../../../store/backupStore';
import { toast } from 'react-hot-toast';

export const BackupFolderCard: React.FC = () => {
  const { backupFolder } = useBackupStore();

  const handleChangeFolder = () => {
    toast('Custom backup folder location is not currently available.', { icon: '🚧' });
  };

  const handleResetDefault = () => {
    toast('Custom backup folder location is not currently available.', { icon: '🚧' });
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Backup Folder</h2>
        <p className="text-slate-500 text-sm mb-4">
          Where every backup file is saved.
        </p>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 font-mono text-sm text-slate-800 break-all">
          {backupFolder}
          <div className="text-xs text-slate-500 mt-1 font-sans">Default folder</div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleChangeFolder}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Change Folder...
          </button>
          <button
            onClick={handleResetDefault}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
};
