import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ShoppingCart, Package, Truck, Users, UserSquare2, BookOpen, Banknote, Undo2, Receipt, LogOut, Moon } from 'lucide-react';

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Point of Sale', path: '/pos', icon: ShoppingCart },
  { name: 'Inventory', path: '/inventory', icon: Package },
  { name: 'Suppliers', path: '/suppliers', icon: Truck },
  { name: 'Employees', path: '/employees', icon: Users },
  { name: 'Deliveries', path: '/deliveries', icon: Truck },
  { name: 'Customers', path: '/customers', icon: UserSquare2 },
  { name: 'Khata / Ledger', path: '/ledger', icon: BookOpen },
  { name: 'Global Cash', path: '/global-cash', icon: Banknote },
  { name: 'Returns', path: '/returns', icon: Undo2 },
  { name: 'Receipt Audit', path: '/audit', icon: Receipt },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-[240px] bg-[#F8FAFC] border-r border-slate-200 h-full flex flex-col text-slate-700">
      <div className="p-5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-serif italic font-bold text-slate-800">G</div>
        <span className="text-sm font-semibold tracking-tight text-slate-800">Gujar Milk Shop</span>
      </div>
      
      <nav className="flex-1 overflow-y-auto py-2 px-3 custom-scrollbar">
        <ul className="space-y-1">
          {navItems.map((item) => (
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

      <div className="p-4 border-t border-slate-200 mt-auto">
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
          <button className="p-1.5 hover:bg-slate-200 rounded-md transition-colors flex items-center gap-2 text-xs font-medium">
            <LogOut className="w-4 h-4" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
