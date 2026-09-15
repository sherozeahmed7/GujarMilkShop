import React, { useState } from 'react';
import { useBackupStore } from '../../../store/backupStore';
import { Download, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { BackupRecord } from '../../../types';
import { toast } from 'react-hot-toast';
import { RestoreBackupModal } from './RestoreBackupModal';
import { DeleteBackupModal } from './DeleteBackupModal';

export const BackupTable: React.FC = () => {
  const { backups, isLoading } = useBackupStore();
  const [restoreModalBackup, setRestoreModalBackup] = useState<BackupRecord | null>(null);
  const [deleteModalBackup, setDeleteModalBackup] = useState<BackupRecord | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  const formatSize = (kb: number) => {
    if (kb > 1024) return `${(kb / 1024).toFixed(2)} MB`;
    return `${kb.toLocaleString()} KB`;
  };

  const handleDownload = async (backup: BackupRecord) => {
    if (downloadingFile) return;
    setDownloadingFile(backup.filename);
    try {
      const url = `http://localhost:5000/api/backup/download/${encodeURIComponent(backup.filename)}`;
      const response = await fetch(url);
      if (!response.ok) {
        let errorMsg = `Download failed (${response.status})`;
        try {
          const data = await response.json();
          errorMsg = data?.error || errorMsg;
        } catch { }
        throw new Error(errorMsg);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = backup.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      const msg = error?.message?.includes('fetch')
        ? 'Cannot reach the local server. Please ensure the backend is running.'
        : (error?.message || 'Failed to download backup.');
      toast.error(msg, { duration: 5000 });
    } finally {
      setDownloadingFile(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 mb-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin mr-3" />
        <span className="text-slate-500">Loading backups...</span>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
        <table className="w-full text-left text-sm text-slate-600 table-fixed">
          <thead className="bg-slate-50 text-slate-500 uppercase font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4 w-full">File</th>
              <th className="px-6 py-4 w-28">Size</th>
              <th className="px-6 py-4 w-48">Created</th>
              <th className="px-6 py-4 w-24">Type</th>
              <th className="px-6 py-4 w-32 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {backups.map((backup) => (
              <tr key={backup.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-medium text-slate-800 truncate" title={backup.filename}>
                  {backup.filename}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {formatSize(backup.sizeKb)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {new Date(backup.createdAt).toLocaleString('en-US', {
                    month: 'numeric', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium">
                    {backup.type || 'Manual'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleDownload(backup)}
                      disabled={downloadingFile === backup.filename}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Download"
                    >
                      {downloadingFile === backup.filename
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Download className="w-4 h-4" />
                      }
                    </button>
                    <button
                      onClick={() => setRestoreModalBackup(backup)}
                      disabled={!!downloadingFile}
                      className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Restore"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteModalBackup(backup)}
                      disabled={!!downloadingFile}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl">📦</span>
                    <span className="font-medium">No backups found</span>
                    <span className="text-xs">Click "Backup Now" to create your first backup.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
