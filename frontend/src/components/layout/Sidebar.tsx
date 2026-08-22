import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../../services/apiClient';
import { 
  LayoutDashboard, ShoppingCart, Package, Truck, UserSquare2, 
  BookOpen, Undo2, Receipt, LogOut, Moon, Clock, Monitor, 
  Database, Wallet, FileText, Settings, ChevronDown, ChevronRight, AlertTriangle 
} from 'lucide-react';

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
  { name: 'Backup', path: '/backup', icon: Database },
  { name: 'Expenses', path: '/expenses', icon: Wallet },
];

const reportItems = [
  { name: 'Sales Report', path: '/reports/sales' },
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
  { name: 'Audit Log', path: '/settings/audit-log' },
  { name: 'Cloud & Sync', path: '/settings/cloud-sync' },
  { name: 'Customer Display', path: '/settings/customer-display' },
  { name: 'Local Backup', path: '/settings/local-backup' },
];

export const Sidebar: React.FC = () => {
  const [reportsOpen, setReportsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const location = useLocation();
  const isReportActive = location.pathname.startsWith('/reports');
  const isSettingsActive = location.pathname.startsWith('/settings');

  const assignedScreensStr = localStorage.getItem('assignedScreens');
  const allowedScreens = assignedScreensStr ? JSON.parse(assignedScreensStr) : [];

  const visibleMainItems = mainNavItems.filter(item => allowedScreens.includes(item.name));
  const visibleReportItems = reportItems.filter(item => allowedScreens.includes(item.name));
  const visibleSettingsItems = settingsItems.filter(item => allowedScreens.includes(item.name));
  const visibleBottomItems = bottomNavItems.filter(item => allowedScreens.includes(item.name));

  // Triggered when user confirms logout inside the modal
  const handleConfirmLogout = async () => {
    setIsLoggingOut(true);
    try {
      // 1. Call protected backend logout endpoint with JWT token
      await apiClient.post('/auth/logout');
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // 2. Clear authentication state from localStorage
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      localStorage.removeItem('role');
      localStorage.removeItem('assignedScreens');
      setIsLoggingOut(false);
      setShowLogoutModal(false);

      // 3. Redirect to login screen
      window.location.href = '/login';
    }
  };

  return (
    <>
      <aside className="w-[240px] bg-[#F8FAFC] border-r border-slate-200 h-full flex flex-col text-slate-700">
        <div className="p-5 flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-serif italic font-bold text-slate-800">G</div>
          <span className="text-sm font-semibold tracking-tight text-slate-800">Gujar Milk Shop</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto py-2 px-3 custom-scrollbar">
          <ul className="space-y-1">
            {/* Main Items */}
            {visibleMainItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      isActive 
                        ? 'bg-slate-200/70 text-slate-900 font-medium shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              </li>
            ))}

            {/* Reports Collapsible */}
            {visibleReportItems.length > 0 && (
              <li>
                <button
                  onClick={() => setReportsOpen(!reportsOpen)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                    isReportActive && !reportsOpen
                      ? 'bg-slate-200/70 text-slate-900 font-medium shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4" />
                    <span>Reports</span>
                  </div>
                  {reportsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${reportsOpen ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                  <ul className="pl-9 space-y-1">
                    {visibleReportItems.map((item) => (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          className={({ isActive }) =>
                            `flex items-center px-3 py-2 rounded-lg text-sm transition-all ${
                              isActive 
                                ? 'bg-blue-50 text-blue-700 font-medium shadow-sm' 
                                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                            }`
                          }
                        >
                          {item.name}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            )}

          {/* Settings Collapsible */}
          {visibleSettingsItems.length > 0 && (
            <li>
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-all ${
                  isSettingsActive && !settingsOpen
                    ? 'bg-slate-200/70 text-slate-900 font-medium shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </div>
                {settingsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${settingsOpen ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                <ul className="pl-9 space-y-1">
                  {visibleSettingsItems.map((item) => (
                    <li key={item.path}>
                      <NavLink
                        to={item.path}
                        className={({ isActive }) =>
                          `flex items-center px-3 py-2 rounded-lg text-sm transition-all ${
                            isActive 
                              ? 'bg-blue-50 text-blue-700 font-medium shadow-sm' 
                              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                          }`
                        }
                      >
                        {item.name}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          )}

            {/* Bottom Items */}
            {visibleBottomItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      isActive 
                        ? 'bg-slate-200/70 text-slate-900 font-medium shadow-sm' 
                        : 'text-slate-600 hover:bg-slate-100'
                    }`
                  }
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Footer & Logout Button */}
        <div className="p-4 border-t border-slate-200 mt-auto shrink-0">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-semibold text-slate-700 text-sm">
              S
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-800">System Admin</span>
              <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded w-fit mt-0.5">ADMIN</span>
            </div>
          </div>
          <div className="flex items-center justify-between px-2 text-slate-500">
            <button className="p-1.5 hover:bg-slate-200 rounded-md transition-colors">
              <Moon className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setShowLogoutModal(true)}
              className="p-1.5 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-2 text-xs font-medium text-red-600 hover:text-red-700"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-sm w-full p-6 text-slate-800 animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header & Icon */}
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <LogOut className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Logout</h3>
                <p className="text-xs text-slate-500 mt-0.5">Are you sure you want to log out of your session?</p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                disabled={isLoggingOut}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
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
