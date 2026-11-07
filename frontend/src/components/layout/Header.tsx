import React from 'react';
import { Search, Sun, Moon, Menu } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { NotificationPanel } from './NotificationPanel';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useSystemClock } from '../../hooks/useSystemClock';
import { useTheme } from '../../context/ThemeContext';
import { useResponsiveSidebar } from '../../context/ResponsiveSidebarContext';

export const Header: React.FC = () => {
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const { dateStr, timeStr } = useSystemClock();
  const { isDark, toggleTheme } = useTheme();
  const { toggleMobileOpen } = useResponsiveSidebar();

  // Determine title from path
  const path = location.pathname;
  let title = 'Dashboard';
  if (path.includes('pos')) title = 'Point of Sale';
  if (path.includes('inventory')) title = 'Inventory';

  return (
    <header className="h-16 flex items-center justify-between px-3 sm:px-4 md:px-6 bg-transparent gap-2 sm:gap-3 md:gap-6 min-w-0 w-full relative z-40">
      
      {/* Title & Mobile Hamburger Area */}
      <div className="shrink-0 flex items-center gap-2 lg:flex-1 min-w-0">
        <button
          type="button"
          onClick={toggleMobileOpen}
          className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-[#a7c4ae] hover:bg-slate-200/70 dark:hover:bg-[#1e3124] focus:outline-none focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#22c55e] transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <h2 className="text-base sm:text-lg md:text-xl font-semibold text-slate-800 dark:text-[#e2f5e8] truncate hidden sm:block transition-colors duration-250">
          {title}
        </h2>
        {/* Very small screens: Show minimal title or let it shrink */}
        <h2 className="text-sm font-semibold text-slate-800 dark:text-[#e2f5e8] truncate block sm:hidden transition-colors duration-250 max-w-[90px] xs:max-w-[120px]">
          {title}
        </h2>
      </div>

      {/* Search Area */}
      <div className="flex-1 flex justify-center min-w-[140px] max-w-md w-full">
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400 dark:text-[#64916e]" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-12 md:pr-16 py-2 border-0 rounded-full bg-white/80 dark:bg-[#1e3124]/80 text-slate-900 dark:text-[#e2f5e8] text-sm focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#22c55e] focus:outline-none placeholder-slate-400 dark:placeholder-[#64916e] shadow-sm transition-all"
            placeholder="Search..."
          />
          <div className="absolute inset-y-0 right-0 pr-2 md:pr-3 flex items-center pointer-events-none hidden sm:flex">
            <span className="text-[10px] md:text-xs text-slate-400 dark:text-[#64916e] bg-slate-100 dark:bg-[#1a2e1f] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#2d4a35] shadow-sm whitespace-nowrap">
              Ctrl K
            </span>
          </div>
        </div>
      </div>

      {/* Status & Notifications Area */}
      <div className="shrink-0 flex justify-end items-center gap-2 md:gap-4 lg:flex-1">
        
        {/* Network Status Indicator */}
        <div className="flex items-center gap-1.5 bg-white/70 dark:bg-[#1a2e1f]/80 px-2.5 md:px-3 py-1.5 rounded-full shadow-sm shrink-0 transition-colors duration-250">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
          <span className={`text-[11px] md:text-xs font-medium ${isOnline ? 'text-slate-700 dark:text-[#a7c4ae]' : 'text-rose-600'}`}>
            {isOnline ? 'Live' : 'Offline'}
          </span>
        </div>
        
        {/* Dynamic System Clock */}
        <div className="bg-white/70 dark:bg-[#1a2e1f]/80 px-2.5 md:px-3 py-1.5 rounded-full text-[11px] md:text-xs font-medium text-slate-700 dark:text-[#a7c4ae] shadow-sm shrink-0 whitespace-nowrap hidden sm:block transition-colors duration-250">
          {dateStr} - {timeStr}
        </div>

        {/* Ultra-compact clock for very small screens (just time) */}
        <div className="bg-white/70 dark:bg-[#1a2e1f]/80 px-2 py-1.5 rounded-full text-[11px] font-medium text-slate-700 dark:text-[#a7c4ae] shadow-sm shrink-0 whitespace-nowrap block sm:hidden transition-colors duration-250">
          {timeStr}
        </div>

        {/* ── Theme Toggle Button ── */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="shrink-0 relative w-9 h-9 flex items-center justify-center rounded-full bg-white/70 dark:bg-[#1e3124]/80 hover:bg-[#FEF3C7] dark:hover:bg-[#22c55e]/20 shadow-sm border border-slate-200/60 dark:border-[#2d4a35] text-slate-600 dark:text-[#86efac] transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#166534] dark:focus:ring-[#22c55e]"
          aria-label="Toggle dark mode"
        >
          <span className={`absolute transition-all duration-300 ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 rotate-90 scale-50'}`}>
            <Sun className="w-4 h-4" />
          </span>
          <span className={`absolute transition-all duration-300 ${!isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`}>
            <Moon className="w-4 h-4" />
          </span>
        </button>

        <div className="shrink-0">
          <NotificationPanel />
        </div>

      </div>
    </header>
  );
};
