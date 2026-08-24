import React, { useState } from 'react';
import { useBackupStore } from '../../../store/backupStore';
import { Download, Trash2, RotateCcw } from 'lucide-react';
import { BackupRecord } from '../../../types';
import { exportToExcel } from '../../../services/backupService';
import { RestoreBackupModal } from './RestoreBackupModal';
import { DeleteBackupModal } from './DeleteBackupModal';

export const BackupTable: React.FC = () => {
  const { backups } = useBackupStore();
  const [restoreModalBackup, setRestoreModalBackup] = useState<BackupRecord | null>(null);
  const [deleteModalBackup, setDeleteModalBackup] = useState<BackupRecord | null>(null);

  const formatSize = (kb: number) => {
    if (kb > 1024) {
      return `${(kb / 1024).toFixed(2)} MB`;
    }
    return `${kb.toLocaleString()} KB`;
  };

  const handleExport = (backup: BackupRecord) => {
    exportToExcel([backup]);
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-500 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">File</th>
                <th className="px-6 py-4">Size</th>
                <th className="px-6 py-4">Created</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-800 break-all max-w-xs">
                    {backup.filename}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {formatSize(backup.sizeKb)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {new Date(backup.createdAt).toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                      {backup.type || 'Auto'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleExport(backup)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Export/Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setRestoreModalBackup(backup)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Restore"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteModalBackup(backup)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No backups found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {restoreModalBackup && (
        <RestoreBackupModal 
          backup={restoreModalBackup} 
          onClose={() => setRestoreModalBackup(null)} 
        />
      )}

      {deleteModalBackup && (
        <DeleteBackupModal 
          backup={deleteModalBackup} 
          onClose={() => setDeleteModalBackup(null)} 
        />
      )}
    </>
  );
};
