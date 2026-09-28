import React from 'react';
import { Folder } from 'lucide-react';
import { useBackupStore } from '../../../store/backupStore';
import { toast } from 'react-hot-toast';
import { open } from '@tauri-apps/plugin-dialog';
import { updateBackupFolder } from '../../../services/backupService';

export const BackupFolderCard: React.FC = () => {
  const { backupFolder, setBackupFolder, loadInitialData } = useBackupStore();

  const handleChangeFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Backup Folder',
      });
      if (selected && typeof selected === 'string') {
        await updateBackupFolder(selected);
        setBackupFolder(selected);
        await loadInitialData();
        toast.success('Backup folder updated successfully.');
      }
    } catch (err: any) {
      toast.error('Failed to change backup folder: ' + err.message);
    }
  };

  const handleResetDefault = async () => {
    try {
      await updateBackupFolder(null);
      await loadInitialData();
      toast.success('Backup folder reset to default.');
    } catch (err: any) {
      toast.error('Failed to reset backup folder: ' + err.message);
    }
  };

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-xl border border-slate-200 dark:border-[#2d4a35] shadow-sm overflow-hidden mb-6">
      <div className="p-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8] mb-2">Backup Folder</h2>
        <p className="text-slate-500 dark:text-[#8ba895] text-sm mb-4">
          Where every backup file is saved.
        </p>

        <div className="bg-slate-50 dark:bg-[#142119] p-3 rounded-lg border border-slate-200 dark:border-[#2d4a35] mb-4 font-mono text-sm text-slate-800 dark:text-[#e2f5e8] break-all">
          {backupFolder}
          <div className="text-xs text-slate-500 dark:text-[#8ba895] mt-1 font-sans">Current folder location</div>
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
            className="px-4 py-2 bg-slate-100 dark:bg-[#111e14] hover:bg-slate-200 dark:hover:bg-[#1e3124] text-slate-700 dark:text-[#e2f5e8] text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            Reset to Default
          </button>
        </div>
      </div>
    </div>
  );
};
