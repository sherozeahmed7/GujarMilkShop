import React from 'react';
import { Search } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NotificationPanel } from './NotificationPanel';

export const Header: React.FC = () => {
  const location = useLocation();
  
  // Format the current date/time to match the screenshot "15 Aug - 07:30 PM"
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  // Determine title from path
  const path = location.pathname;
  let title = 'Dashboard';
  if (path.includes('pos')) title = 'Point of Sale';
  if (path.includes('inventory')) title = 'Inventory';

  return (
    <header className="h-16 flex items-center justify-between px-6 bg-transparent">
      <div className="flex-1">
        <h2 className="text-xl font-semibold text-slate-800">{title}</h2>
      </div>

      <div className="flex-1 flex justify-center">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-16 py-2 border-0 rounded-full bg-white/70 text-slate-900 text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none placeholder-slate-400 shadow-sm"
            placeholder="Search anything..."
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shadow-sm">Ctrl K</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex justify-end items-center gap-4">
        <div className="flex items-center gap-1.5 bg-white/70 px-3 py-1.5 rounded-full shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-xs font-medium text-slate-700">Live</span>
        </div>
        <div className="bg-white/70 px-3 py-1.5 rounded-full text-xs font-medium text-slate-700 shadow-sm">
          {dateStr} - {timeStr}
        </div>
        <NotificationPanel />
      </div>
    </header>
  );
};
