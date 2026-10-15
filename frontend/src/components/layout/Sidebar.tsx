import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/apiClient';
import {
  LayoutDashboard, ShoppingCart, Package, Truck, UserSquare2,
  BookOpen, Undo2, Receipt, LogOut, Moon, Clock, Monitor,
  Database, Wallet, FileText, Settings, ChevronDown, ChevronRight,
  PanelLeftClose, PanelLeftOpen, BookMarked
} from 'lucide-react';
import { BrandLogo } from '../BrandLogo';

const mainNavItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Point of Sale', path: '/pos', icon: ShoppingCart },
  { name: 'Inventory', path: '/inventory', icon: Package },
  { name: 'Suppliers', path: '/suppliers', icon: Truck },
  { name: 'Customers', path: '/customers', icon: UserSquare2 },
  { name: 'Khata / Ledger', path: '/ledger', icon: BookOpen },
  { name: 'Returns', path: '/returns', icon: Undo2 },
  { name: 'Receipt Audit', path: '/audit', icon: Receipt },
  { name: 'Shifts', path: '/shifts', icon: Clock },
  { name: 'Cash Register', path: '/register', icon: Monitor },
  { name: 'Cashbook', path: '/register/cashbook', icon: BookMarked },
  { name: 'Expenses', path: '/expenses', icon: Wallet },
];



const reportItems = [
  { name: 'Sales Report', path: '/reports/sales' },
  { name: 'F2 Sales Report', path: '/reports/f2-sales' },
  { name: 'Supplier Report', path: '/reports/suppliers' },
  { name: 'Customer Report', path: '/reports/customers' },
  { name: 'Inventory Report', path: '/reports/inventory' },
  { name: 'Returns Report', path: '/reports/returns' },
  { name: 'Cash Register Report', path: '/reports/cash-register' },
  { name: 'Shifts Report', path: '/reports/shifts' },
  { name: 'Expenses Report', path: '/reports/expenses' },
  { name: 'Backup Report', path: '/reports/backups' },
  { name: 'Profit & Loss', path: '/reports/profit-loss' },
  { name: 'Activity Logs', path: '/reports/logs' },
];

const bottomNavItems: any[] = [];

const settingsItems = [
  { name: 'Daily Rates', path: '/settings/daily-rates' },
  { name: 'Shop Info', path: '/settings/shop-info' },
  { name: 'POS Config', path: '/settings/pos-config' },
  { name: 'Users & Roles', path: '/settings/users-roles' },
  { name: 'Cloud & Sync', path: '/settings/cloud-sync' },
  { name: 'Local Backup', path: '/settings/local-backup' },
];

export const Sidebar: React.FC = () => {
  // Navigation accordions
  const [reportsOpen, setReportsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  // Logout state
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // --- Sidebar Behavior State ---
  const [isManuallyCollapsed, setIsManuallyCollapsed] = useState(false);
  const [isPosHovered, setIsPosHovered] = useState(false);
  
  const location = useLocation();
  const isPosPage = location.pathname === '/pos';
  const isReportActive = location.pathname.startsWith('/reports');
  const isSettingsActive = location.pathname.startsWith('/settings');

  // The actual visual state of the sidebar
  const isCollapsed = isPosPage ? !isPosHovered : isManuallyCollapsed;

  // POS Edge Detection Logic
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isPosPage) {
       setIsPosHovered(false); // Reset when leaving POS
       return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      // If cursor is very close to the left edge (<= 25px), open it
      if (e.clientX <= 25) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsPosHovered(true);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [isPosPage]);

  const handleMouseEnter = () => {
    if (isPosPage) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setIsPosHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (isPosPage) {
      // Delay closing to prevent flickering
      timeoutRef.current = setTimeout(() => {
        setIsPosHovered(false);
      }, 300);
    }
  };

  // ---------------------------------

  const assignedScreensStr = localStorage.getItem('assignedScreens');
  const allowedScreens = assignedScreensStr ? JSON.parse(assignedScreensStr) : [];
  const userRole = localStorage.getItem('role')?.toLowerCase();
  const isSuperAdmin = userRole === 'super_admin' || userRole === 'super admin';

  const visibleMainItems = mainNavItems.filter(item => isSuperAdmin || allowedScreens.includes(item.name));
  const visibleReportItems = reportItems.filter(item => isSuperAdmin || allowedScreens.includes(item.name));
  const visibleSettingsItems = settingsItems.filter(item => isSuperAdmin || allowedScreens.includes(item.name));
  const visibleBottomItems = bottomNavItems.filter(item => isSuperAdmin || allowedScreens.includes(item.name));

  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      await apiClient.post('/auth/logout');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('role');
      localStorage.removeItem('assignedScreens');
      setIsLoggingOut(false);
      setShowLogoutModal(false);
      window.location.href = '/login';
    }
  };

  return (
    <>
      <aside 
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`${isCollapsed ? 'w-[72px]' : 'w-[240px]'} transition-[width] duration-300 ease-in-out shrink-0 bg-[#F9FAF8] dark:bg-[#111e14] border-r border-slate-200 dark:border-[#1e3124] h-full flex flex-col text-slate-700 dark:text-[#a7c4ae]`}
      >
        {/* Header / Logo */}
        <div className={`p-5 flex items-center shrink-0 border-b border-slate-100 dark:border-[#1e3124] ${isCollapsed ? 'justify-center px-0' : 'gap-3'}`}>
          <BrandLogo variant="sidebar" />
          <span className={`text-sm font-bold tracking-tight text-[#166534] dark:text-[#22c55e] whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
            Gujar Milk Shop
          </span>
        </div>

        {/* Navigation Area */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 px-3 custom-scrollbar">
          <ul className="space-y-1">
            
            {/* Main Items */}
            {visibleMainItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/register'}
                  title={isCollapsed ? item.name : undefined}
                  className={({ isActive }) =>
                    `flex items-center rounded-xl transition-all ${
                      isCollapsed 
                        ? 'justify-center p-2.5 mx-auto w-10 h-10' 
                        : 'gap-3 px-3 py-2.5'
                    } ${
                      isActive
                        ? 'bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] font-semibold shadow-sm shadow-[#166534]/25 dark:shadow-[#22c55e]/20'
                        : 'text-slate-600 dark:text-[#7aab84] hover:bg-[#FEF3C7]/50 dark:hover:bg-[#22c55e]/10 hover:text-[#166534] dark:hover:text-[#86efac]'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className={`text-sm whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                    {item.name}
                  </span>
                </NavLink>
              </li>
            ))}



            {/* Reports Collapsible */}
            {visibleReportItems.length > 0 && (
              <li>
                <button
                  onClick={() => {
                    if (isCollapsed && !isPosPage) setIsManuallyCollapsed(false);
                    setReportsOpen(!reportsOpen);
                  }}
                  title={isCollapsed ? 'Reports' : undefined}
                  className={`w-full flex items-center rounded-xl transition-all ${
                    isCollapsed 
                      ? 'justify-center p-2.5 mx-auto w-10 h-10' 
                      : 'justify-between px-3 py-2.5'
                  } ${
                    isReportActive && !reportsOpen
                      ? 'bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] font-semibold shadow-sm shadow-[#166534]/25 dark:shadow-[#22c55e]/20'
                      : 'text-slate-600 dark:text-[#7aab84] hover:bg-[#FEF3C7]/50 dark:hover:bg-[#22c55e]/10 hover:text-[#166534] dark:hover:text-[#86efac]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span className={`text-sm whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                      Reports
                    </span>
                  </div>
                  {!isCollapsed && (
                    reportsOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${reportsOpen ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                    <ul className="pl-6 space-y-1 border-l-2 border-slate-200/60 dark:border-[#2d4a35]/60 ml-4 my-1">
                      {visibleReportItems.map((item) => (
                        <li key={item.path}>
                          <NavLink
                            to={item.path}
                            className={({ isActive }) =>
                              `flex items-center px-3 py-2 rounded-lg text-xs transition-all whitespace-nowrap ${isActive
                                ? 'bg-[#FEF3C7] dark:bg-[#22c55e]/15 text-[#166534] dark:text-[#86efac] font-bold shadow-xs'
                                : 'text-slate-500 dark:text-[#64916e] hover:bg-[#FEF3C7]/30 dark:hover:bg-[#22c55e]/10 hover:text-[#166534] dark:hover:text-[#86efac]'
                              }`
                            }
                          >
                            {item.name}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            )}

            {/* Settings Collapsible */}
            {visibleSettingsItems.length > 0 && (
              <li>
                <button
                  onClick={() => {
                     if (isCollapsed && !isPosPage) setIsManuallyCollapsed(false);
                     setSettingsOpen(!settingsOpen);
                  }}
                  title={isCollapsed ? 'Settings' : undefined}
                  className={`w-full flex items-center rounded-xl transition-all ${
                    isCollapsed 
                      ? 'justify-center p-2.5 mx-auto w-10 h-10' 
                      : 'justify-between px-3 py-2.5'
                  } ${
                    isSettingsActive && !settingsOpen
                      ? 'bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] font-semibold shadow-sm shadow-[#166534]/25 dark:shadow-[#22c55e]/20'
                      : 'text-slate-600 dark:text-[#7aab84] hover:bg-[#FEF3C7]/50 dark:hover:bg-[#22c55e]/10 hover:text-[#166534] dark:hover:text-[#86efac]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Settings className="w-4 h-4 shrink-0" />
                    <span className={`text-sm whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                      Settings
                    </span>
                  </div>
                  {!isCollapsed && (
                    settingsOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />
                  )}
                </button>

                {!isCollapsed && (
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${settingsOpen ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                    <ul className="pl-6 space-y-1 border-l-2 border-slate-200/60 dark:border-[#2d4a35]/60 ml-4 my-1">
                      {visibleSettingsItems.map((item) => (
                        <li key={item.path}>
                          <NavLink
                            to={item.path}
                            className={({ isActive }) =>
                              `flex items-center px-3 py-2 rounded-lg text-xs transition-all whitespace-nowrap ${isActive
                                ? 'bg-[#FEF3C7] dark:bg-[#22c55e]/15 text-[#166534] dark:text-[#86efac] font-bold shadow-xs'
                                : 'text-slate-500 dark:text-[#64916e] hover:bg-[#FEF3C7]/30 dark:hover:bg-[#22c55e]/10 hover:text-[#166534] dark:hover:text-[#86efac]'
                              }`
                            }
                          >
                            {item.name}
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            )}

            {/* Bottom Items */}
            {visibleBottomItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  title={isCollapsed ? item.name : undefined}
                  className={({ isActive }) =>
                    `flex items-center rounded-xl transition-all ${
                      isCollapsed 
                        ? 'justify-center p-2.5 mx-auto w-10 h-10' 
                        : 'gap-3 px-3 py-2.5'
                    } ${isActive
                      ? 'bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] font-semibold shadow-sm shadow-[#166534]/25 dark:shadow-[#22c55e]/20'
                      : 'text-slate-600 dark:text-[#7aab84] hover:bg-[#FEF3C7]/50 dark:hover:bg-[#22c55e]/10 hover:text-[#166534] dark:hover:text-[#86efac]'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className={`text-sm whitespace-nowrap transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                    {item.name}
                  </span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer Area */}
        <div className="p-4 border-t border-slate-200 dark:border-[#1e3124] mt-auto shrink-0 flex flex-col items-center">
          
          {/* User Profile */}
          <div className={`flex items-center mb-4 w-full ${isCollapsed ? 'justify-center' : 'gap-3 px-2'}`}>
            {(() => {
              const userName = localStorage.getItem('userName') || '';
              const role = localStorage.getItem('role') || 'user';
              // Show name if set and not the generic fallback; otherwise show role
              const displayName = userName && userName !== 'User' ? userName : role;
              const initial = displayName.charAt(0).toUpperCase();
              return (
                <>
                  <div className="w-8 h-8 shrink-0 rounded-full bg-[#FEF3C7] dark:bg-[#22c55e]/20 border border-[#FDE68A] dark:border-[#22c55e]/40 flex items-center justify-center font-bold text-[#166534] dark:text-[#22c55e] text-sm shadow-xs">
                    {initial}
                  </div>
                  {!isCollapsed && (
                    <div className="flex flex-col whitespace-nowrap overflow-hidden">
                      <span className="text-xs font-semibold text-slate-800 dark:text-[#e2f5e8] truncate">{displayName}</span>
                      <span className="text-[10px] font-bold text-[#166534] dark:text-[#22c55e] bg-[#FEF3C7] dark:bg-[#22c55e]/15 border border-[#FDE68A] dark:border-[#22c55e]/30 px-2 py-0.5 rounded-md w-fit mt-0.5 uppercase tracking-wider">{role}</span>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Action Buttons */}
          <div className={`flex text-slate-500 dark:text-[#64916e] w-full ${isCollapsed ? 'flex-col items-center gap-2' : 'items-center justify-between px-2'}`}>
            
            {/* Sidebar Toggle (Only show on normal pages) */}
            {!isPosPage && (
              <button 
                onClick={() => setIsManuallyCollapsed(!isManuallyCollapsed)}
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
                className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#1e3124] rounded-md transition-colors flex justify-center items-center"
              >
                {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              </button>
            )}

            {/* Logout */}
            <button
              onClick={() => setShowLogoutModal(true)}
              title={isCollapsed ? "Log Out" : undefined}
              className={`p-1.5 hover:bg-slate-200 dark:hover:bg-[#2d1515] rounded-md transition-colors flex items-center justify-center gap-2 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300`}
            >
              <LogOut className="w-4 h-4 shrink-0" />
              {!isCollapsed && <span className="whitespace-nowrap">Log Out</span>}
            </button>

          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl border border-slate-100 dark:border-[#2d4a35] max-w-sm w-full p-6 text-slate-800 dark:text-[#e2f5e8] animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <LogOut className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-[#e2f5e8]">Confirm Logout</h3>
                <p className="text-xs text-slate-500 dark:text-[#64916e] mt-0.5">Are you sure you want to log out of your session?</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100 dark:border-[#2d4a35]">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg transition-colors shadow-sm shadow-red-600/20 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isLoggingOut ? 'Logging out...' : 'Log Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
