import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Package,
  ShoppingCart,
  CreditCard,
  AlertTriangle,
  Undo2,
  TrendingUp,
  HardDrive,
  CheckCheck,
  X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifCategory =
  | 'stock'
  | 'sale'
  | 'credit'
  | 'return'
  | 'target'
  | 'backup';

export interface Notification {
  id: number;
  category: NotifCategory;
  title: string;
  description: string;
  time: string;         // e.g. "5 min ago"
  isRead: boolean;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
// Replace this array with real data (SQLite query / IPC call) later.
// The shape of each object must match the Notification interface above.

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    category: 'stock',
    title: 'Low Stock Alert',
    description: 'Full Cream Milk (1L) has only 12 units remaining.',
    time: '2 min ago',
    isRead: false,
  },
  {
    id: 2,
    category: 'sale',
    title: 'New Sale Completed',
    description: 'Walk-in sale of Rs. 1,240 recorded — Bill #5441.',
    time: '8 min ago',
    isRead: false,
  },
  {
    id: 3,
    category: 'credit',
    title: 'Pending Customer Credit',
    description: 'Ali Khan has an outstanding balance of Rs. 45,000.',
    time: '22 min ago',
    isRead: false,
  },
  {
    id: 4,
    category: 'stock',
    title: 'Running Out of Stock',
    description: 'Desi Ghee (500g) stock below reorder level — 5 units left.',
    time: '1 hr ago',
    isRead: false,
  },
  {
    id: 5,
    category: 'return',
    title: 'Return Processed',
    description: 'Return of Rs. 360 approved for Zainab Stores — Bill #5398.',
    time: '2 hr ago',
    isRead: true,
  },
  {
    id: 6,
    category: 'target',
    title: 'Daily Target Reached!',
    description: 'Today\'s sales crossed Rs. 1,50,000 — target achieved at 4:30 PM.',
    time: '3 hr ago',
    isRead: true,
  },
  {
    id: 7,
    category: 'backup',
    title: 'Backup Reminder',
    description: 'Last database backup was 3 days ago. Consider backing up now.',
    time: 'Yesterday',
    isRead: true,
  },
  {
    id: 8,
    category: 'credit',
    title: 'Credit Limit Warning',
    description: 'Usman Dairy has reached 90% of their credit limit.',
    time: 'Yesterday',
    isRead: true,
  },
];

// ─── Icon + colour map ───────────────────────────────────────────────────────

const CATEGORY_META: Record<
  NotifCategory,
  { icon: React.ElementType; bg: string; iconColor: string }
> = {
  stock:  { icon: Package,     bg: 'bg-amber-50',   iconColor: 'text-amber-500'   },
  sale:   { icon: ShoppingCart,bg: 'bg-emerald-50',  iconColor: 'text-emerald-500' },
  credit: { icon: CreditCard,  bg: 'bg-indigo-50',  iconColor: 'text-indigo-500'  },
  return: { icon: Undo2,       bg: 'bg-rose-50',    iconColor: 'text-rose-500'    },
  target: { icon: TrendingUp,  bg: 'bg-blue-50',    iconColor: 'text-blue-500'    },
  backup: { icon: HardDrive,   bg: 'bg-slate-100',  iconColor: 'text-slate-500'   },
};

// ─── NotificationItem ────────────────────────────────────────────────────────

interface NotificationItemProps {
  notif: Notification;
  onMarkRead: (id: number) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notif, onMarkRead }) => {
  const { icon: Icon, bg, iconColor } = CATEGORY_META[notif.category];

  return (
    <li
      className={`flex gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors cursor-default group relative ${
        !notif.isRead ? 'bg-blue-50/40' : ''
      }`}
    >
      {/* Unread indicator bar */}
      {!notif.isRead && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-blue-500" />
      )}

      {/* Category icon */}
      <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${bg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${notif.isRead ? 'text-slate-700 font-medium' : 'text-slate-900 font-semibold'}`}>
            {notif.title}
          </p>
          {/* Mark-as-read button (visible on hover when unread) */}
          {!notif.isRead && (
            <button
              onClick={() => onMarkRead(notif.id)}
              title="Mark as read"
              className="shrink-0 p-1 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors opacity-0 group-hover:opacity-100"
            >
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

// ─── NotificationPanel ───────────────────────────────────────────────────────

export const NotificationPanel: React.FC = () => {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [open, setOpen] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current  && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = (id: number) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        id="notification-bell-btn"
        aria-label="Open notifications"
        onClick={() => setOpen((v) => !v)}
        className={`relative p-2 rounded-full transition-colors ${
          open ? 'bg-blue-100 text-blue-600' : 'hover:bg-slate-200 text-slate-600'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-red-500 text-white rounded-full leading-none ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          id="notification-panel"
          className="absolute right-0 top-[calc(100%+10px)] z-[9999] w-[min(420px,calc(100vw-24px))] bg-white rounded-2xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden"
          style={{ maxHeight: 'calc(100vh - 80px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-600" />
              <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all as read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable list */}
          <ul className="overflow-y-auto divide-y divide-slate-50">
            {notifications.length === 0 ? (
              <li className="py-12 text-center text-sm text-slate-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                No notifications
              </li>
            ) : (
              notifications.map((notif) => (
                <NotificationItem key={notif.id} notif={notif} onMarkRead={markRead} />
              ))
            )}
          </ul>


        </div>
      )}
    </div>
  );
};
