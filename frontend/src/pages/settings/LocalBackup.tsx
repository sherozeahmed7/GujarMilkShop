import React, { useEffect } from 'react';
import { useBackupStore } from '../../store/backupStore';
import { BackupActionButtons } from '../../components/settings/backup/BackupActionButtons';
import { BackupFolderCard } from '../../components/settings/backup/BackupFolderCard';
import { BackupTable } from '../../components/settings/backup/BackupTable';
import { BackupStats } from '../../components/settings/backup/BackupStats';
import { AutoBackupSettings } from '../../components/settings/backup/AutoBackupSettings';
import { RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const LocalBackup: React.FC = () => {
  const { loadInitialData } = useBackupStore();

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleRefresh = async () => {
    try {
      toast.loading('Refreshing...', { id: 'refresh-toast' });
      await loadInitialData();
      toast.success('Data refreshed.', { id: 'refresh-toast' });
    } catch (e) {
      toast.error('Failed to refresh data.', { id: 'refresh-toast' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-y-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Backup & Restore</h1>
          <p className="text-sm text-slate-500 mt-1">Create local backups of your database. Auto-backup runs nightly at 2:00 AM.</p>
        </div>
        <button 
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>
      
      <BackupActionButtons />
      <BackupFolderCard />
      <AutoBackupSettings />
      <BackupStats />
      <BackupTable />
      
      {/* Add a little padding at the bottom so scrolling feels nice */}
      <div className="h-6"></div>
    </div>
  );
};
