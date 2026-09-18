import React from 'react';
import { Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NotificationPanel } from './NotificationPanel';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useSystemClock } from '../../hooks/useSystemClock';

export const Header: React.FC = () => {
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { dateStr, timeStr } = useSystemClock();

  // Determine title from path
  const path = location.pathname;
  let title = 'Dashboard';
  if (path.includes('pos')) title = 'Point of Sale';
  if (path.includes('inventory')) title = 'Inventory';

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-6 bg-transparent gap-3 md:gap-6 min-w-0 w-full relative z-50">
      
      {/* Title Area */}
      <div className="shrink-0 flex items-center lg:flex-1 min-w-0">
        <h2 className="text-lg md:text-xl font-semibold text-slate-800 truncate hidden sm:block">
          {title}
        </h2>
        {/* Very small screens: Show minimal title or let it shrink */}
        <h2 className="text-lg font-semibold text-slate-800 truncate block sm:hidden">
          {title.length > 9 ? title.substring(0, 9) + '...' : title}
        </h2>
      </div>

      {/* Search Area */}
      <div className="flex-1 flex justify-center min-w-[140px] max-w-md w-full">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-12 md:pr-16 py-2 border-0 rounded-full bg-white/80 text-slate-900 text-sm focus:ring-2 focus:ring-[#166534] focus:outline-none placeholder-slate-400 shadow-sm transition-all"
            placeholder="Search..."
          />
          <div className="absolute inset-y-0 right-0 pr-2 md:pr-3 flex items-center pointer-events-none hidden sm:flex">
            <span className="text-[10px] md:text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-sm whitespace-nowrap">
              Ctrl K
            </span>
          </div>
        </div>
      </div>

      {/* Status & Notifications Area */}
      <div className="shrink-0 flex justify-end items-center gap-2 md:gap-4 lg:flex-1">
        
        {/* Network Status Indicator */}
        <div className="flex items-center gap-1.5 bg-white/70 px-2.5 md:px-3 py-1.5 rounded-full shadow-sm shrink-0">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          <span className={`text-[11px] md:text-xs font-medium ${isOnline ? 'text-slate-700' : 'text-rose-600'}`}>
            {isOnline ? 'Live' : 'Offline'}
          </span>
        </div>
        
        {/* Dynamic System Clock */}
        <div className="bg-white/70 px-2.5 md:px-3 py-1.5 rounded-full text-[11px] md:text-xs font-medium text-slate-700 shadow-sm shrink-0 whitespace-nowrap hidden sm:block">
          {dateStr} - {timeStr}
        </div>

        {/* Ultra-compact clock for very small screens (just time) */}
        <div className="bg-white/70 px-2 py-1.5 rounded-full text-[11px] font-medium text-slate-700 shadow-sm shrink-0 whitespace-nowrap block sm:hidden">
          {timeStr}
        </div>
        
        <div className="shrink-0">
          <NotificationPanel />
        </div>

      </div>
    </header>
  );
};
