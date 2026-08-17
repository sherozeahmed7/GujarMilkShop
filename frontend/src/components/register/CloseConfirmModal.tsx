import React from 'react';
import { Lock, AlertTriangle, X } from 'lucide-react';
import { useRegisterStore } from '../../store/registerStore';

interface CloseConfirmModalProps {
  onClose: () => void;
}

export const CloseConfirmModal: React.FC<CloseConfirmModalProps> = ({ onClose }) => {
  const { closeRegister } = useRegisterStore();

  const handleConfirm = () => {
    closeRegister();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-500" />
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Close Register</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <h3 className="text-lg font-bold text-slate-800">Are you sure?</h3>
          <p className="text-sm text-slate-500">
            Once closed, no further transactions can be processed on this register until it is reopened. The Z-Report will be finalized.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
          >
            Yes, Close Register
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold rounded-xl transition-all"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
