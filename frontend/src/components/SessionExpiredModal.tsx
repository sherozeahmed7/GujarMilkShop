import React, { useEffect, useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';

/**
 * SessionExpiredModal
 * Listens for the global 'session-expired' custom event dispatched by apiClient
 * whenever any API call returns 401 Unauthorized.
 * Blocks the UI and forces the user to re-login.
 */
export const SessionExpiredModal: React.FC = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => setVisible(true);
    window.addEventListener('session-expired', handleSessionExpired);
    return () => window.removeEventListener('session-expired', handleSessionExpired);
  }, []);

  if (!visible) return null;

  const handleLoginRedirect = () => {
    // Navigate to login — use hard redirect so the React tree fully resets
    window.location.href = '/login';
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-sm mx-4 overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 to-orange-500" />

        <div className="p-8 flex flex-col items-center text-center">
          {/* Icon */}
          <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center mb-5">
            <ShieldAlert className="w-8 h-8 text-amber-500" />
          </div>

          {/* Title */}
          <h2 className="text-xl font-bold text-slate-800 mb-2">Session Expired</h2>
          <p className="text-sm text-slate-500 leading-relaxed mb-8">
            Your session has expired or you are not authorized.<br />
            Please log in again to continue.
          </p>

          {/* CTA Button */}
          <button
            onClick={handleLoginRedirect}
            className="w-full flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm shadow-emerald-600/20"
          >
            <LogOut className="w-4 h-4" />
            Go to Login
          </button>
        </div>
      </div>
    </div>
  );
};
