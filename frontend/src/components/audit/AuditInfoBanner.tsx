import React from 'react';
import { AlertCircle } from 'lucide-react';

export const AuditInfoBanner: React.FC = () => (
  <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-xl px-4 py-3 flex-shrink-0">
    <AlertCircle className="w-4 h-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
    <p className="text-sm text-blue-800 dark:text-blue-300 font-medium">
      <span className="font-bold">Pakistan shop rule:</span> customer gives receipt to item counter, item counter keeps it.
      If the paper receipt is returned, the same customer may try to claim items again.
    </p>
  </div>
);
