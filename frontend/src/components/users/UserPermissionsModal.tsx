import React from 'react';
import { X } from 'lucide-react';
import { User } from '../../types/user';
import { SCREEN_PERMISSIONS } from '../../config/screenPermissions';

interface UserPermissionsModalProps {
  user: User;
  onClose: () => void;
}

export const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({ user, onClose }) => {
  const { assignedScreens } = user;

  const renderGroup = (title: string, screens: string[]) => (
    <div className="mb-6 last:mb-0">
      <h3 className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {screens.map(screen => {
          const hasAccess = assignedScreens.includes(screen);
          return (
            <div 
              key={screen} 
              className={`flex items-center gap-2 p-2 rounded-lg border ${
                hasAccess 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-white dark:bg-[#142119] border-slate-200 dark:border-[#2d4a35] text-slate-400 dark:text-[#64916e] opacity-70'
              }`}
            >
              <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${hasAccess ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-[#2d4a35]'}`}>
                {hasAccess ? (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-3 h-3 text-slate-400 dark:text-[#64916e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <span className={`text-sm ${hasAccess ? 'font-medium' : 'font-normal'}`}>{screen}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">View Permissions</h2>
            <p className="text-sm text-slate-500 dark:text-[#8ba895] mt-1">{user.name} ({user.role})</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50 dark:bg-[#142119]">
          {renderGroup('MAIN MODULES', SCREEN_PERMISSIONS.MAIN_MODULES)}
          {renderGroup('SETTINGS', SCREEN_PERMISSIONS.SETTINGS)}
          {renderGroup('REPORTS', SCREEN_PERMISSIONS.REPORTS)}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-slate-100 dark:border-[#2d4a35] bg-white dark:bg-[#1a2e1f] rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium text-slate-700 dark:text-[#a7c4ae] bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#1e3124] rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
