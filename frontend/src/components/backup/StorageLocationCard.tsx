import React, { useState } from 'react';
import { FolderOpen, Database } from 'lucide-react';
import { STORAGE_INFO } from '../../data/backupMockData';
import { openBackupFolder } from '../../services/backupService';

interface StorageLocationCardProps {
  onInfo: (msg: string) => void;
}

export const StorageLocationCard: React.FC<StorageLocationCardProps> = ({ onInfo }) => {
  const handleOpenFolder = async () => {
    try {
      await openBackupFolder();
    } catch (e: any) {
      onInfo('Backup folder opening is available when filesystem integration is enabled.');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col gap-5">
      <h3 className="font-bold text-slate-800">Storage Location</h3>

      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Database</p>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
            <Database className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-600 font-mono break-all">{STORAGE_INFO.dbPath}</p>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Backups Folder</p>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5">
            <FolderOpen className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="text-xs text-slate-600 font-mono break-all">{STORAGE_INFO.backupPath}</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleOpenFolder}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all shadow-sm"
      >
        <FolderOpen className="w-4 h-4 text-blue-500" />
        Open Backup Folder
      </button>
    </div>
  );
};
