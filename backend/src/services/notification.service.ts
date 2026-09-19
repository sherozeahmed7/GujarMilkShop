import { prisma } from '../config/database';

export interface CreateNotificationPayload {
  category: 'inventory' | 'customer' | 'sale' | 'return' | 'khata' | 'shift' | 'supplier' | 'sync' | 'backup' | 'system' | string;
  title: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any> | string | null;
  dedupeHours?: number;
}

export class NotificationService {
  /**
   * Safely create a notification with optional deduplication and action links.
   */
  static async create(payload: CreateNotificationPayload) {
    try {
      const metadataObj: Record<string, any> =
        typeof payload.metadata === 'object' && payload.metadata !== null
          ? { ...payload.metadata }
          : typeof payload.metadata === 'string'
          ? tryParseJson(payload.metadata)
          : {};

      if (payload.actionUrl) metadataObj.actionUrl = payload.actionUrl;
      if (payload.actionLabel) metadataObj.actionLabel = payload.actionLabel;

      // Deduplication check: Avoid spamming identical unread notifications within dedupe window
      if (payload.dedupeHours && payload.dedupeHours > 0) {
        const sinceDate = new Date(Date.now() - payload.dedupeHours * 60 * 60 * 1000);
        const existing = await prisma.notification.findFirst({
          where: {
            category: payload.category,
            title: payload.title,
            isRead: false,
            createdAt: { gte: sinceDate },
          },
        });

        if (existing) {
          return { success: true, data: existing, deduplicated: true };
        }
      }

      const metadataStr = Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : null;

      const record = await prisma.notification.create({
        data: {
          category: payload.category,
          title: payload.title,
          message: payload.message,
          metadata: metadataStr,
        },
      });
      return { success: true, data: record };
    } catch (error) {
      console.error('[NotificationService.create] Failed to create notification:', error);
      return { success: false, error };
    }
  }

  /**
   * Run background scans for pending system alerts:
   * 1. Low stock products below threshold
   * 2. Shifts open for >12 hours
   * 3. Failed sync queue records
   * 4. High customer khata balances
   * 5. High supplier payable balances
   */
  static async runSystemAlertChecks() {
    try {
      // 1. Check Low Stock Products
      const products = await prisma.inventoryProduct.findMany({
        where: { isActive: true, lowStockThreshold: { gt: 0 } },
        include: { movements: { select: { quantity: true } } },
      });

      for (const prod of products) {
        const currentStock = prod.movements.reduce((sum, m) => sum + m.quantity, 0);
        if (currentStock <= prod.lowStockThreshold) {
          await this.create({
            category: 'inventory',
            title: 'Low Stock Alert',
            message: `${prod.name} stock (${Math.round(currentStock * 100) / 100} ${prod.unit}) is at or below threshold (${prod.lowStockThreshold} ${prod.unit}).`,
            actionUrl: '/inventory',
            actionLabel: 'View Inventory',
            metadata: { productId: prod.id, name: prod.name, currentStock, threshold: prod.lowStockThreshold },
            dedupeHours: 12,
          });
        }
      }

      // 2. Check Shifts Open for > 12 hours
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
      const staleShifts = await prisma.shift.findMany({
        where: {
          status: 'Open',
          openedAt: { lte: twelveHoursAgo },
        },
        include: { openedBy: true },
      });

      for (const shift of staleShifts) {
        const opener = shift.openedBy?.name || shift.openedBy?.email || 'Cashier';
        await this.create({
          category: 'shift',
          title: 'Shift Not Closed',
          message: `Shift #${shift.id} opened by ${opener} has been running for over 12 hours without being closed.`,
          actionUrl: '/shifts',
          actionLabel: 'Review / Close Shift',
          metadata: { shiftId: shift.id, openedAt: shift.openedAt },
          dedupeHours: 12,
        });
      }

      // 3. Check Failed Cloud Sync Records
      const failedSyncCount = await prisma.syncQueue.count({
        where: { status: 'FAILED' },
      });

      if (failedSyncCount > 0) {
        await this.create({
          category: 'sync',
          title: 'Failed Sync Alert',
          message: `${failedSyncCount} record${failedSyncCount > 1 ? 's' : ''} failed to sync to cloud. Retries may be needed.`,
          actionUrl: '/settings/cloud-sync',
          actionLabel: 'Retry Sync',
          metadata: { failedCount: failedSyncCount },
          dedupeHours: 6,
        });
      }

      // 4. Check Pending Customer Due (Khata balances >= Rs. 5,000)
      const customerWithHighDue = await prisma.sale.groupBy({
        by: ['customerId'],
        where: {
          customerId: { not: null },
          remainingBalance: { gt: 0 },
        },
        _sum: {
          remainingBalance: true,
        },
        having: {
          remainingBalance: {
            _sum: {
              gte: 5000,
            },
          },
        },
        orderBy: {
          _sum: {
            remainingBalance: 'desc',
          },
        },
        take: 1,
      });

      if (customerWithHighDue.length > 0 && customerWithHighDue[0].customerId) {
        const debtorCust = await prisma.customer.findUnique({
          where: { id: customerWithHighDue[0].customerId },
        });
        const dueBalance = customerWithHighDue[0]._sum.remainingBalance || 0;
        if (debtorCust && dueBalance >= 5000) {
          await this.create({
            category: 'khata',
            title: 'Pending Customer Due',
            message: `${debtorCust.name} owes Rs. ${Math.round(dueBalance).toLocaleString()} in outstanding ledger balance.`,
            actionUrl: '/khata',
            actionLabel: 'Open Khata / Receive Payment',
            metadata: { customerId: debtorCust.id, customerName: debtorCust.name, balance: dueBalance },
            dedupeHours: 24,
          });
        }
      }

      // 5. Check Pending Supplier Payment (Net payable >= Rs. 15,000)
      const suppliers = await prisma.supplier.findMany({
        where: { isActive: true },
        include: {
          collections: { select: { amount: true } },
          payments: { select: { amount: true } },
        },
      });

      for (const sup of suppliers) {
        const totalPurchased = sup.collections.reduce((sum: number, c: { amount: number }) => sum + c.amount, 0);
        const totalPaid = sup.payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0);
        const advance = Number(sup.guaranteedAdvance) || 0;
        const netPayable = (totalPurchased - advance) - totalPaid;

        if (netPayable >= 15000) {
          await this.create({
            category: 'supplier',
            title: 'Pending Supplier Payment',
            message: `Supplier "${sup.name}" has an outstanding payable balance of Rs. ${Math.round(netPayable).toLocaleString()}.`,
            actionUrl: '/suppliers',
            actionLabel: 'Pay / Open Ledger',
            metadata: { supplierId: sup.id, supplierName: sup.name, netPayable },
            dedupeHours: 24,
          });
          break; // alert top supplier payable per cycle
        }
      }
    } catch (err) {
      console.error('[NotificationService.runSystemAlertChecks] Error running alert scanner:', err);
    }
  }

  /**
   * List notifications sorted by newest first, with unread count.
   */
  static async list(filters?: { limit?: number; unreadOnly?: boolean }) {
    // Non-blocking trigger of background state checks
    this.runSystemAlertChecks().catch(() => {});

    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    const where: any = {};
    if (filters?.unreadOnly) {
      where.isRead = false;
    }

    const [notifications, unreadCount, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.notification.count({
        where: { isRead: false },
      }),
      prisma.notification.count(),
    ]);

    return {
      success: true,
      statusCode: 200,
      data: {
        notifications: notifications.map((n) => ({
          ...n,
          metadata: n.metadata ? tryParseJson(n.metadata) : null,
        })),
        unreadCount,
        total,
      },
    };
  }

  /**
   * Mark a single notification as read.
   */
  static async markRead(id: number) {
    try {
      const existing = await prisma.notification.findUnique({ where: { id } });
      if (!existing) {
        return { success: false, statusCode: 404, message: 'Notification not found.' };
      }

      const updated = await prisma.notification.update({
        where: { id },
        data: { isRead: true },
      });

      return {
        success: true,
        statusCode: 200,
        message: 'Notification marked as read.',
        data: updated,
      };
    } catch (error) {
      console.error('[NotificationService.markRead] Error:', error);
      return { success: false, statusCode: 500, message: 'Failed to update notification.' };
    }
  }

  /**
   * Mark all unread notifications as read.
   */
  static async markAllRead() {
    try {
      const result = await prisma.notification.updateMany({
        where: { isRead: false },
        data: { isRead: true },
      });

      return {
        success: true,
        statusCode: 200,
        message: 'All notifications marked as read.',
        data: { updatedCount: result.count },
      };
    } catch (error) {
      console.error('[NotificationService.markAllRead] Error:', error);
      return { success: false, statusCode: 500, message: 'Failed to mark all as read.' };
    }
  }

  /**
   * Delete a single notification.
   */
  static async delete(id: number) {
    try {
      await prisma.notification.delete({ where: { id } });
      return {
        success: true,
        statusCode: 200,
        message: 'Notification deleted.',
      };
    } catch (error) {
      return { success: false, statusCode: 500, message: 'Failed to delete notification.' };
    }
  }
}

function tryParseJson(str: any): any {
  if (!str) return null;
  if (typeof str === 'object') return str;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

