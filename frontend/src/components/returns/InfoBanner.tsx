import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const InfoBanner: React.FC = () => (
  <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-xl px-4 py-3 flex-shrink-0">
    <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
    <p className="text-sm text-amber-800 dark:text-amber-300 font-medium">
      <span className="font-bold">Never delete old bills.</span>{' '}
      Create a return so the audit trail stays clean.
    </p>
  </div>
);
