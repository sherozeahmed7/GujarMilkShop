import React from 'react';
import { AlertCircle } from 'lucide-react';

export const AuditInfoBanner: React.FC = () => (
  <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex-shrink-0">
    <AlertCircle className="w-4 h-4 text-blue-500 flex-shrink-0" />
    <p className="text-sm text-blue-800 font-medium">
      <span className="font-bold">Pakistan shop rule:</span> customer gives receipt to item counter, item counter keeps it.
      If the paper receipt is returned, the same customer may try to claim items again.
    </p>
  </div>
);
