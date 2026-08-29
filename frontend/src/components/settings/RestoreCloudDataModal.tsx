import React, { useState } from 'react';
import { X, AlertTriangle, DownloadCloud } from 'lucide-react';
import { cloudSyncService } from '../../services/cloudSync.service';

interface RestoreCloudDataModalProps {
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const RestoreCloudDataModal: React.FC<RestoreCloudDataModalProps> = ({ onClose, onSuccess }) => {
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async () => {
    setIsRestoring(true);
    setError(null);
    try {
      const result = await cloudSyncService.restoreCloudData();
      if (result.success) {
        onSuccess(`Successfully restored ${result.records} records from the cloud.`);
        onClose();
      } else {
        setError('Failed to restore cloud data.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to restore cloud data.');
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2 text-red-600">
            <DownloadCloud className="w-5 h-5" />
            <h2 className="text-lg font-bold">Restore Cloud Data?</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
              {error}
            </div>
          )}

          <p className="text-slate-600 text-sm mb-4">
            You are about to restore data from the cloud backup. This operation may overwrite some of your local offline changes.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
            <div className="flex justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Backup Date</span>
              <span className="text-sm text-slate-800 font-bold">15 Aug 2026, 07:38 PM</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">Estimated Records</span>
              <span className="text-sm text-slate-800 font-bold">~ 14,025</span>
            </div>
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 font-medium">
              Please ensure your local internet connection is stable. Do not close the application during the restore process.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isRestoring}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleRestore}
            disabled={isRestoring}
            className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isRestoring ? 'Restoring...' : 'Restore Data'}
          </button>
        </div>
      </div>
    </div>
  );
};
