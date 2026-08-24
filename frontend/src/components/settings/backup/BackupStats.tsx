import React from 'react';
import { useBackupStore } from '../../../store/backupStore';
import { HardDrive, Clock, CheckCircle2, ShieldCheck } from 'lucide-react';

export const BackupStats: React.FC = () => {
  const { backups } = useBackupStore();

  const totalBackups = backups.length;
  
  const totalSizeKb = backups.reduce((acc, curr) => acc + curr.sizeKb, 0);
  const totalSize = totalSizeKb > 1024 
    ? `${(totalSizeKb / 1024).toFixed(2)} MB` 
    : `${totalSizeKb.toLocaleString()} KB`;

  const latestBackup = backups.length > 0 ? backups[0] : null;
  const latestBackupDate = latestBackup 
    ? new Date(latestBackup.createdAt).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : 'Never';

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500 font-medium">Total Backups</div>
          <div className="text-lg font-bold text-slate-800">{totalBackups}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500 font-medium">Latest Backup</div>
          <div className="text-sm font-bold text-slate-800">{latestBackupDate}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 flex-shrink-0">
          <HardDrive className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500 font-medium">Total Storage</div>
          <div className="text-lg font-bold text-slate-800">{totalSize}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <div className="text-xs text-slate-500 font-medium">Status</div>
          <div className="text-lg font-bold text-emerald-600">Healthy</div>
        </div>
      </div>
    </div>
  );
};
