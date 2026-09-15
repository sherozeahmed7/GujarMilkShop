import React, { useState } from 'react';
import { Database, RefreshCw, FolderOpen } from 'lucide-react';
import { useBackupStore } from '../../../store/backupStore';
import { openBackupFolder, restoreBackupFromFile } from '../../../services/backupService';
import { toast } from 'react-hot-toast';
import { open } from '@tauri-apps/plugin-dialog';

export const BackupActionButtons: React.FC = () => {
  const { createBackup, isCreating, loadInitialData } = useBackupStore();
  const [isRestoring, setIsRestoring] = useState(false);
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);

  const handleBackupNow = async () => {
    try {
      toast.loading('Creating backup...', { id: 'backup-toast' });
      await createBackup();
      toast.success('Backup created successfully!', { id: 'backup-toast' });
    } catch (error: any) {
      const msg = error?.message || 'Failed to create backup.';
      toast.error(msg, { id: 'backup-toast', duration: 5000 });
    }
  };

  const handleOpenFolder = async () => {
    setIsOpeningFolder(true);
    try {
      await openBackupFolder();
    } catch (error: any) {
      const msg = error?.message || 'Could not open backup folder.';
      toast.error(msg, { id: 'folder-toast' });
    } finally {
      setIsOpeningFolder(false);
    }
  };

  const handleRestoreFromFile = async () => {
    if (isRestoring) return;
    setIsRestoring(true);

    try {
      let selectedPath: string | null = null;

      try {
        const result = await open({
          multiple: false,
          filters: [{ name: 'Database Backup', extensions: ['db', 'sqlite', 'bak'] }]
        });
        if (!result) return; // User cancelled picker
        selectedPath = Array.isArray(result) ? result[0] : result;
      } catch (pickerErr: any) {
        toast.error('Could not open file picker: ' + (pickerErr?.message || 'Unknown error'), { id: 'restore-toast' });
        return;
      }

      if (!selectedPath) return;

      if (!window.confirm(
        `Restoring this backup will replace the current database.\n\nFile: ${selectedPath}\n\nA safety backup will be created automatically before the restore.\n\nContinue?`
      )) {
        return;
      }

      toast.loading('Validating and restoring backup...', { id: 'restore-toast' });
      await restoreBackupFromFile(selectedPath);
      await loadInitialData();
      toast.success(
        'Restore successful! Please restart the application to apply all changes.',
        { id: 'restore-toast', duration: 8000 }
      );
    } catch (error: any) {
      const msg = error?.message || 'Restore failed. Please try again.';
      toast.error(msg, { id: 'restore-toast', duration: 8000 });
    } finally {
      setIsRestoring(false);
    }
  };

  const isAnyProcessing = isCreating || isRestoring || isOpeningFolder;

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      <button
        onClick={handleBackupNow}
        disabled={isAnyProcessing}
        className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Database className="w-5 h-5" />
        {isCreating ? 'Creating...' : 'Backup Now'}
      </button>

      <button
        onClick={handleRestoreFromFile}
        disabled={isAnyProcessing}
        className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw className={`w-5 h-5 ${isRestoring ? 'animate-spin' : ''}`} />
        {isRestoring ? 'Restoring...' : 'Restore from File'}
      </button>

      <button
        onClick={handleOpenFolder}
        disabled={isAnyProcessing}
        className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FolderOpen className="w-5 h-5" />
        {isOpeningFolder ? 'Opening...' : 'Open Backup Folder'}
      </button>
    </div>
  );
};
