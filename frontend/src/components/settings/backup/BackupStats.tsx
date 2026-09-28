import React from 'react';
import { useBackupStore } from '../../../store/backupStore';
import { HardDrive, Clock, CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';

export const BackupStats: React.FC = () => {
  const { summary } = useBackupStore();

  const totalSizeKb = summary.totalStorageKb || 0;
  const totalSize = totalSizeKb > 1024 
    ? `${(totalSizeKb / 1024).toFixed(2)} MB` 
    : `${totalSizeKb.toLocaleString()} KB`;

  const latestBackupDate = summary.latestBackup 
    ? new Date(summary.latestBackup).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : 'Never';

  const isHealthy = summary.status === 'Healthy';

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-xl border border-slate-200 dark:border-[#2d4a35] p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-[#8ba895] font-medium">Total Backups</div>
          <div className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">{summary.totalBackups}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] rounded-xl border border-slate-200 dark:border-[#2d4a35] p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-[#8ba895] font-medium">Latest Backup</div>
          <div className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{latestBackupDate}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] rounded-xl border border-slate-200 dark:border-[#2d4a35] p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
          <HardDrive className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-[#8ba895] font-medium">Total Storage</div>
          <div className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">{totalSize}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a2e1f] rounded-xl border border-slate-200 dark:border-[#2d4a35] p-4 flex items-center gap-4">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isHealthy ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isHealthy ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
        </div>
        <div>
          <div className="text-xs text-slate-500 dark:text-[#8ba895] font-medium">Status</div>
          <div className={`text-lg font-bold ${isHealthy ? 'text-emerald-600' : 'text-rose-600'}`}>{summary.status}</div>
        </div>
      </div>
    </div>
  );
};
