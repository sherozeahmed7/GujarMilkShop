import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { User } from '../../types/user';
import { useUserStore } from '../../store/userStore';
import { toast } from 'react-hot-toast';

interface ToggleStatusModalProps {
  user: User;
  onClose: () => void;
}

export const ToggleStatusModal: React.FC<ToggleStatusModalProps> = ({ user, onClose }) => {
  const { changeStatus } = useUserStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const newStatus = user.status.toLowerCase() === 'active' ? 'inactive' : 'active';
  const isDeactivating = newStatus === 'inactive';

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await changeStatus(user.id, newStatus);
      toast.success(`User successfully marked as ${newStatus}.`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update user status');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0">
          <div className={`flex items-center gap-2 ${isDeactivating ? 'text-orange-600' : 'text-emerald-600'}`}>
            <AlertCircle className="w-5 h-5" />
            <h2 className="text-lg font-bold">
              {isDeactivating ? 'Deactivate User?' : 'Activate User?'}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors"
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
          
          <p className="text-slate-600 dark:text-[#a7c4ae] text-sm">
            Are you sure you want to change <span className="font-bold text-slate-800 dark:text-[#e2f5e8]">{user.name}</span>'s status to{' '}
            <span className={`font-bold ${isDeactivating ? 'text-orange-600' : 'text-emerald-600'}`}>
              {newStatus.toUpperCase()}
            </span>?
          </p>

          <div className={`mt-4 p-4 border rounded-xl ${
            isDeactivating 
              ? 'bg-orange-50 border-orange-100' 
              : 'bg-emerald-50 border-emerald-100'
          }`}>
            <p className={`text-xs ${isDeactivating ? 'text-orange-800' : 'text-emerald-800'}`}>
              {isDeactivating 
                ? 'This user will no longer be able to log in or access the system.'
                : 'This user will regain access to the system and their assigned screens.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-[#a7c4ae] hover:text-slate-800 dark:hover:text-[#e2f5e8] hover:bg-slate-200 dark:hover:bg-[#1e3124] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`px-6 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 ${
              isDeactivating 
                ? 'bg-orange-600 hover:bg-orange-700' 
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isSubmitting 
              ? 'Saving...' 
              : isDeactivating ? 'Deactivate User' : 'Activate User'
            }
          </button>
        </div>
      </div>
    </div>
  );
};
