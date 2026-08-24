import React, { useState } from 'react';
import { Folder } from 'lucide-react';
import { useBackupStore } from '../../../store/backupStore';
import { changeBackupFolder, resetBackupFolder } from '../../../services/backupService';
import { toast } from 'react-hot-toast';

export const BackupFolderCard: React.FC = () => {
  const { backupFolder, setBackupFolder } = useBackupStore();
  const [copyExisting, setCopyExisting] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const handleChangeFolder = async () => {
    try {
      setIsChanging(true);
      const newFolder = await changeBackupFolder();
      setBackupFolder(newFolder);
      toast.success('Backup folder updated successfully.');
      if (copyExisting) {
        toast.success('Existing backups copied to new location.');
      }
    } catch (error: any) {
      toast.error('Failed to change folder.');
    } finally {
      setIsChanging(false);
    }
  };

  const handleResetDefault = async () => {
    try {
      setIsChanging(true);
      const defaultFolder = await resetBackupFolder();
      setBackupFolder(defaultFolder);
      toast.success('Reset to default folder.');
    } catch (error) {
      toast.error('Failed to reset folder.');
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="p-6">
        <h2 className="text-lg font-bold text-slate-800 mb-2">Backup Folder</h2>
        <p className="text-slate-500 text-sm mb-4">
          Where every backup file is saved. Picking a folder on a USB stick or a synced cloud folder (OneDrive, Google Drive) means you get an off-PC copy automatically.
        </p>

        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 font-mono text-sm text-slate-800 break-all">
          {backupFolder}
          <div className="text-xs text-slate-500 mt-1 font-sans">Default folder</div>
        </div>

        <label className="flex items-center gap-2 mb-6 cursor-pointer">
          <input
            type="checkbox"
            checked={copyExisting}
            onChange={(e) => setCopyExisting(e.target.checked)}
            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-600"
          />
          <span className="text-sm text-slate-700">Copy existing backups to new folder</span>
        </label>

        <div className="flex gap-3">
          <button
            onClick={handleChangeFolder}
            disabled={isChanging}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Change Folder...
          </button>
          <button
            onClick={handleResetDefault}
            disabled={isChanging}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
};
