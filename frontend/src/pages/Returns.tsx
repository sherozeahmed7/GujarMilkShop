import React, { useState } from 'react';
import { InfoBanner } from '../components/returns/InfoBanner';
import { CreateReturnPanel } from '../components/returns/CreateReturnPanel';
import { RecentReturnsPanel } from '../components/returns/RecentReturnsPanel';

export const Returns: React.FC = () => {
  const [highlightLatest, setHighlightLatest] = useState(false);

  const handleReturnCreated = () => {
    setHighlightLatest(true);
    // Remove highlight after 4 seconds
    setTimeout(() => setHighlightLatest(false), 4000);
  };

  return (
    <div className="flex flex-col h-full gap-4 min-h-0">
      {/* Page Header */}
      <div className="flex items-start justify-between flex-shrink-0 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Bill Corrections &amp; Refunds</h1>
          <p className="text-slate-500 text-sm mt-1">Reverse sold items safely or correct mistakes.</p>
        </div>
        <div className="flex-1 flex justify-end min-w-0">
          <InfoBanner />
        </div>
      </div>

      {/* Main Two-Panel Layout */}
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* Left: Create Return */}
        <div className="w-[58%] flex-shrink-0 min-h-0 flex flex-col overflow-hidden">
          <CreateReturnPanel onReturnCreated={handleReturnCreated} />
        </div>

        {/* Right: Recent Returns */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <RecentReturnsPanel highlightLatest={highlightLatest} />
        </div>
      </div>
    </div>
  );
};
