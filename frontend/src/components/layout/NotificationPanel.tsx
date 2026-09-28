import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell, Package, ShoppingCart, CreditCard, Undo2,
  Users, Clock, Check, CheckCheck, X, Loader2, Sparkles,
  RefreshCw, Truck, Cloud, HardDrive, ArrowUpRight, AlertTriangle
} from 'lucide-react';
import { notificationService, AppNotification } from '../../services/notificationService';

type NotifCategory = 'all' | 'unread' | 'inventory' | 'customer' | 'sale' | 'return' | 'khata' | 'shift' | 'supplier' | 'sync' | 'backup' | 'system';

type CategoryMetaKey = Exclude<NotifCategory, 'all' | 'unread'>;

const CATEGORY_META: Record<CategoryMetaKey, { icon: typeof Package; bg: string; iconColor: string; label: string }> = {
  inventory: { icon: Package,      bg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200/80 dark:border-amber-500/20',  iconColor: 'text-amber-600',  label: 'Inventory' },
  customer:  { icon: Users,        bg: 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200/80 dark:border-cyan-500/20',     iconColor: 'text-cyan-600',   label: 'Customer' },
  sale:      { icon: ShoppingCart, bg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/20', iconColor: 'text-emerald-600', label: 'Sale' },
  return:    { icon: Undo2,        bg: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200/80 dark:border-rose-500/20',     iconColor: 'text-rose-600',   label: 'Return' },
  khata:     { icon: CreditCard,   bg: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-500/20', iconColor: 'text-indigo-600', label: 'Khata' },
  shift:     { icon: Clock,        bg: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200/80 dark:border-purple-500/20', iconColor: 'text-purple-600', label: 'Shift' },
  supplier:  { icon: Truck,        bg: 'bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-200/80 dark:border-teal-500/20',     iconColor: 'text-teal-600',   label: 'Supplier' },
  sync:      { icon: Cloud,        bg: 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200/80 dark:border-orange-500/20', iconColor: 'text-orange-600', label: 'Sync' },
  backup:    { icon: HardDrive,    bg: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200/80 dark:border-red-500/20',        iconColor: 'text-red-600',    label: 'Backup' },
  system:    { icon: AlertTriangle,bg: 'bg-slate-50 dark:bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-500/20',  iconColor: 'text-slate-600',  label: 'System' },
};

function timeAgo(iso: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 5)    return 'Just now';
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch {
    return 'Recently';
  }
}

interface NotificationItemProps {
  notif: AppNotification;
  onMarkRead: (id: number) => void;
  onAction: (url: string, id: number) => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notif, onMarkRead, onAction }) => {
  const meta = CATEGORY_META[notif.category as CategoryMetaKey] || CATEGORY_META.system;
  const Icon = meta.icon;
  const actionUrl = notif.metadata?.actionUrl;
  const actionLabel = notif.metadata?.actionLabel;

  return (
    <li
      className={`group relative rounded-xl border p-4 transition-all duration-200 ${
        !notif.isRead
          ? 'bg-blue-50/50 dark:bg-[#1e3124] border-blue-100/90 dark:border-[#22c55e]/35 shadow-2xs'
          : 'bg-white dark:bg-[#1a2e1f] border-slate-100 dark:border-[#2d4a35] hover:border-slate-200/80 dark:hover:border-[#3d5a45] hover:bg-slate-50/50 dark:hover:bg-[#1e3124]'
      }`}
    >
      {/* Left unread indicator pill */}
      {!notif.isRead && (
        <span className="absolute left-0 top-3.5 bottom-3.5 w-1 bg-blue-600 dark:bg-[#22c55e] rounded-r-full" />
      )}

      <div className="flex items-start gap-3">
        {/* Category Icon */}
        <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border shadow-xs mt-0.5 ${meta.bg}`}>
          <Icon className="w-4.5 h-4.5" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs ${notif.isRead ? 'font-semibold text-slate-700 dark:text-[#c5dbc9]' : 'font-bold text-slate-900 dark:text-[#e2f5e8]'}`}>
                {notif.title}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-[#8ba895] uppercase tracking-wider bg-slate-100/80 dark:bg-[#142119] px-2 py-0.5 rounded-md border border-transparent dark:border-[#2d4a35]">
                {meta.label}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-[#7aab84] font-medium shrink-0">
              {timeAgo(notif.createdAt)}
            </span>
          </div>

          <p className="text-xs text-slate-600 dark:text-[#a7c4ae] leading-relaxed break-words pr-1">
            {notif.message}
          </p>

          {/* Action Button if actionable metadata exists */}
          {actionUrl && (
            <div className="mt-2.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(actionUrl, notif.id);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-[#22c55e]/15 text-blue-700 dark:text-[#86efac] hover:bg-blue-600 dark:hover:bg-[#22c55e] hover:text-white dark:hover:text-[#0d1a10] border border-blue-200 dark:border-[#22c55e]/35 hover:border-blue-600 dark:hover:border-[#22c55e] transition-all duration-150 shadow-2xs group/btn active:scale-95"
              >
                <span>{actionLabel || 'View Details'}</span>
                <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5" />
              </button>
            </div>
          )}
        </div>

        {/* Action: Tick button to mark as read */}
        <div className="shrink-0 flex items-center self-start pt-0.5 pl-1">
          {!notif.isRead ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notif.id);
              }}
              title="Mark as read"
              className="w-7 h-7 rounded-lg bg-white dark:bg-[#142119] hover:bg-emerald-50 dark:hover:bg-[#22c55e]/15 text-slate-400 dark:text-[#7aab84] hover:text-emerald-600 dark:hover:text-[#22c55e] border border-slate-200 dark:border-[#2d4a35] hover:border-emerald-300 dark:hover:border-[#22c55e]/50 flex items-center justify-center transition-all duration-150 shadow-2xs active:scale-95"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span title="Read" className="w-7 h-7 flex items-center justify-center text-slate-300 dark:text-[#3d5a45]">
              <Check className="w-3.5 h-3.5" />
            </span>
          )}
        </div>
      </div>
    </li>
  );
};

export const NotificationPanel: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  // Two-stage state for smooth opening & closing slide transitions
  const [isRendered, setIsRendered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<NotifCategory>('all');

  const drawerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async (showSpin = false) => {
    if (showSpin) setIsRefreshing(true);
    try {
      const data = await notificationService.getNotifications({ limit: 100 });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      if (showSpin) setIsRefreshing(false);
    }
  }, []);

  // Poll every 5 seconds (5000ms) for real-time live notification updates
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(() => {
      loadNotifications();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleOpen = () => {
    setIsRendered(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimating(true);
      });
    });
    setLoading(true);
    loadNotifications().finally(() => setLoading(false));
  };

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    setTimeout(() => {
      setIsRendered(false);
    }, 300);
  }, []);

  // Control body scroll
  useEffect(() => {
    if (isRendered) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isRendered]);

  // Close on Escape key
  useEffect(() => {
    if (!isRendered) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isRendered, handleClose]);

  const handleMarkRead = async (id: number) => {
    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await notificationService.markAsRead(id);
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      loadNotifications();
    }
  };

  const handleAction = async (url: string, id: number) => {
    const target = notifications.find((n) => n.id === id);
    if (target && !target.isRead) {
      handleMarkRead(id);
    }
    handleClose();
    navigate(url);
  };

  const handleMarkAllRead = async () => {
    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      await notificationService.markAllAsRead();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
      loadNotifications();
    }
  };

  // Filter items
  const filteredNotifications = notifications.filter((notif) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'unread') return !notif.isRead;
    return notif.category === selectedFilter;
  });

  return (
    <>
      {/* Bell Trigger Button */}
      <button
        id="notification-bell-btn"
        aria-label="Open notifications drawer"
        onClick={handleOpen}
        className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-[#1e3124] text-slate-600 dark:text-[#7aab84] hover:text-slate-800 dark:hover:text-[#86efac] transition-all duration-200 active:scale-95"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1.5 flex items-center justify-center text-[10px] font-bold bg-rose-500 text-white rounded-full leading-none ring-2 ring-white dark:ring-[#111e14] shadow-xs animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-over Drawer with Smooth Transitions */}
      {isRendered && (
        <div className="fixed inset-0 z-[9999] overflow-hidden">
          {/* Backdrop Overlay with Fade transition */}
          <div
            onClick={handleClose}
            className={`fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-300 ease-in-out ${
              isAnimating ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          />

          {/* Drawer Panel Container with Slide transition */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div
              ref={drawerRef}
              className={`w-screen max-w-md bg-white dark:bg-[#142119] shadow-2xl flex flex-col border-l border-slate-200 dark:border-[#1e3124] h-full transition-transform duration-300 ease-out ${
                isAnimating ? 'translate-x-0' : 'translate-x-full'
              }`}
            >
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-[#1e3124] bg-slate-50/90 dark:bg-[#111e14] flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#166534] dark:bg-[#22c55e] text-white dark:text-[#0d1a10] flex items-center justify-center shadow-xs">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800 dark:text-[#e2f5e8] leading-tight">Notifications</h3>
                    <p className="text-xs text-slate-500 dark:text-[#7aab84] mt-0.5">
                      {unreadCount > 0 ? `${unreadCount} unread update${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Mark All as Read — primary action button in header */}
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      title="Mark all notifications as read"
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 dark:bg-[#22c55e] text-white dark:text-[#0d1a10] hover:bg-blue-700 dark:hover:bg-[#4ade80] active:bg-blue-800 dark:active:bg-[#22c55e] transition-all duration-150 shadow-sm shadow-blue-600/25 dark:shadow-[#22c55e]/20 active:scale-95 whitespace-nowrap"
                    >
                      <CheckCheck className="w-3.5 h-3.5 shrink-0" />
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => loadNotifications(true)}
                    disabled={isRefreshing}
                    className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-[#1e3124] text-slate-500 dark:text-[#7aab84] hover:text-slate-800 dark:hover:text-[#e2f5e8] transition-colors"
                    title="Refresh notifications"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600 dark:text-[#22c55e]' : ''}`} />
                  </button>
                  <button
                    onClick={handleClose}
                    className="p-2 rounded-xl hover:bg-slate-200/70 dark:hover:bg-[#1e3124] text-slate-400 dark:text-[#7aab84] hover:text-slate-800 dark:hover:text-[#e2f5e8] transition-colors"
                    aria-label="Close notifications drawer"
                    title="Close drawer (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Sub-header Filters */}
              <div className="px-5 py-3 border-b border-slate-100 dark:border-[#2d4a35] bg-white dark:bg-[#142119] flex items-center shrink-0 gap-1.5 overflow-x-auto custom-scrollbar">
                {(['all', 'unread', 'inventory', 'khata', 'shift', 'supplier', 'sale', 'return', 'sync'] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setSelectedFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all whitespace-nowrap ${
                      selectedFilter === filter
                        ? 'bg-blue-600 dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-2xs'
                        : 'bg-slate-100/90 dark:bg-[#1a2e1f] text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-200/80 dark:hover:bg-[#1e3124] border border-transparent dark:border-[#2d4a35]'
                    }`}
                  >
                    {filter === 'all' ? 'All' : filter === 'unread' ? `Unread (${unreadCount})` : filter}
                  </button>
                ))}
              </div>

              {/* Drawer Body / Scrollable List with Generous Padding */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50/40 dark:bg-[#0d1a10] p-5">
                {loading && notifications.length === 0 ? (
                  <div className="py-24 flex flex-col items-center justify-center text-slate-400 dark:text-[#7aab84] gap-2.5 text-xs">
                    <Loader2 className="w-7 h-7 animate-spin text-blue-500 dark:text-[#22c55e]" />
                    <span className="font-medium">Loading notifications…</span>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="py-24 px-6 text-center flex flex-col items-center justify-center">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#1a2e1f] border border-slate-100 dark:border-[#2d4a35] shadow-2xs flex items-center justify-center mb-3.5 text-slate-400 dark:text-[#8ba895]">
                      <Sparkles className="w-6 h-6 text-slate-300 dark:text-[#64916e]" />
                    </div>
                    <p className="text-slate-800 dark:text-[#e2f5e8] font-bold text-sm">No notifications found</p>
                    <p className="text-slate-400 dark:text-[#7aab84] text-xs mt-1.5 max-w-xs leading-relaxed">
                      {selectedFilter !== 'all'
                        ? `No notifications found under the "${selectedFilter}" category.`
                        : 'Actionable alerts for low stock, pending payments, shift discrepancies, and sync health will appear here.'}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {filteredNotifications.map((notif) => (
                      <NotificationItem
                        key={notif.id}
                        notif={notif}
                        onMarkRead={handleMarkRead}
                        onAction={handleAction}
                      />
                    ))}
                  </ul>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="px-6 py-3.5 border-t border-slate-100 dark:border-[#2d4a35] bg-white dark:bg-[#111e14] flex items-center justify-between text-xs text-slate-500 dark:text-[#8ba895] shrink-0">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Live alerts active (5s)
                </span>
                <span className="font-medium text-slate-600 dark:text-[#a7c4ae]">{filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

