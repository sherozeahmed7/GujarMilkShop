import React, { useRef } from 'react';
import { Database, RefreshCw, FolderOpen, Download } from 'lucide-react';
import { useBackupStore } from '../../../store/backupStore';
import { openBackupFolder, restoreBackupFromFile } from '../../../services/backupService';
import { toast } from 'react-hot-toast';

export const BackupActionButtons: React.FC = () => {
  const { createBackup, isCreating } = useBackupStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackupNow = async () => {
    try {
      toast.loading('Creating backup...', { id: 'backup-toast' });
      await createBackup();
      toast.success('Backup created successfully!', { id: 'backup-toast' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to create backup.', { id: 'backup-toast' });
    }
  };

  const handleOpenFolder = async () => {
    try {
      await openBackupFolder();
    } catch (error: any) {
      toast.error('Could not open folder in mock mode.', { id: 'folder-toast' });
    }
  };

  const handleRestoreFromFile = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm('Restoring this backup may replace current local data. Make sure you have a recent backup before continuing.')) {
      e.target.value = '';
      return;
    }

    try {
      toast.loading('Restoring from file...', { id: 'restore-toast' });
      await restoreBackupFromFile(file);
      toast.success('Restore successful!', { id: 'restore-toast' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to restore.', { id: 'restore-toast' });
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="flex flex-wrap gap-4 mb-6">
      <button
        onClick={handleBackupNow}
        disabled={isCreating}
        className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors shadow-sm disabled:opacity-50"
      >
        <Database className="w-5 h-5" />
        {isCreating ? 'Creating...' : 'Backup Now'}
      </button>

      <button
        onClick={handleRestoreFromFile}
        className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-medium transition-colors shadow-sm"
      >
        <RefreshCw className="w-5 h-5" />
        Restore from File
      </button>
      
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={onFileChange} 
        className="hidden" 
        accept=".db,.sqlite,.bak" 
      />

      <button
        onClick={handleOpenFolder}
        className="flex-1 min-w-[200px] flex items-center justify-center gap-2 px-6 py-4 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-medium transition-colors shadow-sm"
      >
        <FolderOpen className="w-5 h-5" />
        Open Backup Folder
      </button>
    </div>
  );
};
