import { apiClient } from './apiClient';

export interface AppNotification {
  id: number;
  category: 'inventory' | 'customer' | 'sale' | 'return' | 'khata' | 'shift' | 'system' | string;
  title: string;
  message: string;
  isRead: boolean;
  metadata?: any;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponse {
  notifications: AppNotification[];
  unreadCount: number;
  total: number;
}

export const notificationService = {
  /**
   * GET /api/notifications
   */
  getNotifications: async (params?: { limit?: number; unreadOnly?: boolean }): Promise<NotificationsResponse> => {
    const res = await apiClient.get('/notifications', {
      ...(params?.limit ? { limit: String(params.limit) } : {}),
      ...(params?.unreadOnly ? { unreadOnly: 'true' } : {}),
    });
    return (res.data || { notifications: [], unreadCount: 0, total: 0 }) as NotificationsResponse;
  },

  /**
   * PATCH /api/notifications/:id/read
   */
  markAsRead: async (id: number): Promise<AppNotification> => {
    const res = await apiClient.patch(`/notifications/${id}/read`);
    return res.data as AppNotification;
  },

  /**
   * PATCH /api/notifications/read-all
   */
  markAllAsRead: async (): Promise<{ updatedCount: number }> => {
    const res = await apiClient.patch('/notifications/read-all');
    return res.data as { updatedCount: number };
  },

  /**
   * DELETE /api/notifications/:id
   */
  deleteNotification: async (id: number): Promise<void> => {
    await apiClient.delete(`/notifications/${id}`);
  },
};
