import { prisma } from '../config/database';

export interface CreateNotificationPayload {
  category: 'inventory' | 'customer' | 'sale' | 'return' | 'khata' | 'shift' | 'system' | string;
  title: string;
  message: string;
  metadata?: Record<string, any> | string | null;
}

export class NotificationService {
  /**
   * Safely create a notification. Catches and logs errors so it never breaks caller flows.
   */
  static async create(payload: CreateNotificationPayload) {
    try {
      const metadataStr =
        payload.metadata && typeof payload.metadata === 'object'
          ? JSON.stringify(payload.metadata)
          : (payload.metadata as string) || null;

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
   * List notifications sorted by newest first, with unread count.
   */
  static async list(filters?: { limit?: number; unreadOnly?: boolean }) {
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

function tryParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
