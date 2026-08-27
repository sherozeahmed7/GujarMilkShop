import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Bell, Package, ShoppingCart, CreditCard, Undo2, TrendingUp, CheckCheck, X, Loader2 } from 'lucide-react';
import { apiClient } from '../../services/apiClient';

type NotifCategory = 'stock' | 'sale' | 'credit' | 'return' | 'target';

export interface Notification {
  id: number;
  category: NotifCategory;
  title: string;
  description: string;
  time: string;
  isRead: boolean;
}

const CATEGORY_META: Record<NotifCategory, { icon: React.ElementType; bg: string; iconColor: string }> = {
  stock:  { icon: Package,      bg: 'bg-amber-50',  iconColor: 'text-amber-500'   },
  sale:   { icon: ShoppingCart, bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
  credit: { icon: CreditCard,   bg: 'bg-indigo-50', iconColor: 'text-indigo-500'  },
  return: { icon: Undo2,        bg: 'bg-rose-50',   iconColor: 'text-rose-500'    },
  target: { icon: TrendingUp,   bg: 'bg-blue-50',   iconColor: 'text-blue-500'    },
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)  return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

async function fetchNotifications(): Promise<Notification[]> {
  const today = new Date().toISOString().split('T')[0];
  const results: Notification[] = [];
  let id = 1;

  try {
    // 1. Low stock items from inventory
    const inv = await apiClient.get('/inventory');
    const products: any[] = inv.data ?? [];
    const lowStock = products.filter((p: any) => p.status === 'Warning: Low' || p.status === 'Out of Stock');
    lowStock.slice(0, 3).forEach((p: any) => {
      results.push({
        id: id++, category: 'stock',
        title: p.status === 'Out of Stock' ? 'Out of Stock' : 'Low Stock Alert',
        description: `${p.name} — ${p.stock} ${p.unit} remaining.`,
        time: 'Now', isRead: false,
      });
    });
  } catch { /* silent — notifications are non-critical */ }

  try {
    // 2. Recent sales (last 5)
    const sales = await apiClient.get('/sales', { fromDate: today, toDate: today });
    const salesList: any[] = (sales.data ?? []).slice(0, 3);
    salesList.forEach((s: any) => {
      results.push({
        id: id++, category: 'sale',
        title: 'Sale Completed',
        description: `${s.saleType === 'walk_in' ? 'Walk-in' : 'Khata'} sale of Rs. ${Math.round(s.totalAmount).toLocaleString()} — Bill #${s.id}.`,
        time: timeAgo(s.createdAt), isRead: true,
      });
    });
  } catch { /* silent */ }

  try {
    // 3. Outstanding khata customers
    const customers = await apiClient.get('/customers', { dues: 'true' });
    const customerList: any[] = (customers.data ?? []).slice(0, 2);
    customerList.forEach((c: any) => {
      if (c.remainingBalance > 0) {
        results.push({
          id: id++, category: 'credit',
          title: 'Pending Khata Balance',
          description: `${c.name} has an outstanding balance of Rs. ${Math.round(c.remainingBalance ?? 0).toLocaleString()}.`,
          time: 'Now', isRead: false,
        });
      }
    });
  } catch { /* silent */ }

  try {
    // 4. Recent returns
    const returns = await apiClient.get('/returns', { fromDate: today, toDate: today });
    const returnList: any[] = (returns.data ?? []).slice(0, 2);
    returnList.forEach((r: any) => {
      results.push({
        id: id++, category: 'return',
        title: 'Return Processed',
        description: `Return of Rs. ${Math.round(r.refundAmount).toLocaleString()} for ${r.customer}.`,
        time: timeAgo(r.createdAt || new Date().toISOString()), isRead: true,
      });
    });
  } catch { /* silent */ }

  return results;
}

const NotificationItem: React.FC<{ notif: Notification; onMarkRead: (id: number) => void }> = ({ notif, onMarkRead }) => {
  const { icon: Icon, bg, iconColor } = CATEGORY_META[notif.category];
  return (
    <li className={`flex gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors cursor-default group relative ${!notif.isRead ? 'bg-blue-50/40' : ''}`}>
      {!notif.isRead && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-blue-500" />}
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${bg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${notif.isRead ? 'text-slate-700 font-medium' : 'text-slate-900 font-semibold'}`}>{notif.title}</p>
          {!notif.isRead && (
            <button onClick={() => onMarkRead(notif.id)} title="Mark as read"
              className="shrink-0 p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 leading-snug line-clamp-2">{notif.description}</p>
        <p className="text-[10px] text-slate-400 mt-1.5 font-medium">{notif.time}</p>
      </div>
    </li>
  );
};

export const NotificationPanel: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load when panel opens
  useEffect(() => { if (open) load(); }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead    = (id: number) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  const markAllRead = () => setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));

  return (
    <div className="relative">
      <button ref={buttonRef} id="notification-bell-btn" aria-label="Open notifications"
        onClick={() => setOpen(v => !v)}
        className={`relative p-2 rounded-full transition-colors ${open ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-200 text-slate-600'}`}>
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full leading-none ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div ref={panelRef} className="absolute right-0 top-[calc(100%+10px)] z-[9999] w-[min(420px,calc(100vw-24px))] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden" style={{ maxHeight: 'calc(100vh - 80px)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
              {unreadCount > 0 && <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{unreadCount} new</span>}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
                  <CheckCheck className="w-3.5 h-3.5" />Mark all as read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 ml-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <ul className="overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <li className="py-10 flex flex-col items-center justify-center text-slate-400 gap-2 text-sm">
                <Loader2 className="w-6 h-6 animate-spin" />
                Loading notifications…
              </li>
            ) : notifications.length === 0 ? (
              <li className="py-12 text-center text-sm text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No notifications right now.
              </li>
            ) : (
              notifications.map(n => <NotificationItem key={n.id} notif={n} onMarkRead={markRead} />)
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
