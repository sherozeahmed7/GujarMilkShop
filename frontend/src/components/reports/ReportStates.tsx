import React from 'react';
import { RefreshCw } from 'lucide-react';

// ─── Loading State ────────────────────────────────────────────────────────────
export const LoadingState: React.FC<{ message?: string }> = ({ message = 'Loading report...' }) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 dark:text-[#64916e]">
    <RefreshCw className="w-8 h-8 animate-spin" />
    <p className="text-sm font-medium">{message}</p>
  </div>
);

// ─── Empty State ──────────────────────────────────────────────────────────────
interface EmptyStateProps {
  message?: string;
  onRefresh?: () => void;
}
export const EmptyState: React.FC<EmptyStateProps> = ({
  message = 'No data available for the selected period.',
  onRefresh,
}) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400 dark:text-[#64916e]">
    <div className="w-12 h-12 bg-slate-100 dark:bg-[#142119] rounded-full flex items-center justify-center">
      <svg className="w-6 h-6 text-slate-300 dark:text-[#64916e]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2M3 21h18M12 3v4m0 0l-2-2m2 2l2-2" />
      </svg>
    </div>
    <p className="text-sm font-medium text-center max-w-xs">{message}</p>
    {onRefresh && (
      <button onClick={onRefresh} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium mt-1">
        <RefreshCw className="w-4 h-4" /> Retry
      </button>
    )}
  </div>
);

// ─── Error State ──────────────────────────────────────────────────────────────
interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}
export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Unable to load report. Please try again.',
  onRetry,
}) => (
  <div className="flex flex-col items-center justify-center py-20 gap-3">
    <div className="w-12 h-12 bg-rose-100 dark:bg-rose-500/15 rounded-full flex items-center justify-center">
      <svg className="w-6 h-6 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    </div>
    <p className="text-sm font-medium text-rose-600 dark:text-rose-400 text-center max-w-xs">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium mt-1">
        <RefreshCw className="w-4 h-4" /> Try Again
      </button>
    )}
  </div>
);
