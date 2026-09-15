import React, { useState } from 'react';
import { X, AlertTriangle, Trash2 } from 'lucide-react';
import { BackupRecord } from '../../../types';
import { useBackupStore } from '../../../store/backupStore';
import { toast } from 'react-hot-toast';

interface DeleteBackupModalProps {
  backup: BackupRecord;
  onClose: () => void;
}

export const DeleteBackupModal: React.FC<DeleteBackupModalProps> = ({ backup, onClose }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const { deleteBackup } = useBackupStore();

  const handleDelete = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      toast.loading('Deleting backup...', { id: 'delete-toast' });
      await deleteBackup(backup.filename);
      toast.success('Backup deleted successfully.', { id: 'delete-toast' });
      onClose();
    } catch (error: any) {
      const msg = error?.message || 'Failed to delete backup.';
      toast.error(msg, { id: 'delete-toast', duration: 5000 });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5" />
            <h2 className="text-lg font-bold">Delete Backup</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-slate-600 text-sm mb-4">
            Are you sure you want to delete this backup? This action cannot be undone.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4 break-all text-sm font-medium text-slate-800">
            {backup.filename}
          </div>

          <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-800 font-medium">
              This backup file will be permanently removed from disk.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete Backup'}
          </button>
        </div>
      </div>
    </div>
  );
};
