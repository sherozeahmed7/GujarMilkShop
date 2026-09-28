import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { User } from '../../types/user';
import { useUserStore } from '../../store/userStore';

interface DeleteUserModalProps {
  user: User;
  onClose: () => void;
}

export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({ user, onClose }) => {
  const { deleteUser } = useUserStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteUser(user.id);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            <h2 className="text-lg font-bold">Delete User?</h2>
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
            Are you sure you want to delete <span className="font-bold text-slate-800 dark:text-[#e2f5e8]">{user.name}</span>? 
            This action cannot be undone.
          </p>

          <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-xs text-red-800">
              Note: This will permanently remove their access to the system. Audit logs involving this user will be retained.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-[#a7c4ae] hover:text-slate-800 dark:hover:text-[#e2f5e8] hover:bg-slate-200 dark:hover:bg-[#1e3124] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting || user.isPrimaryAdmin}
            className="px-6 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete User'}
          </button>
        </div>
      </div>
    </div>
  );
};
