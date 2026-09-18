import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ApiResponse } from '../utils/apiResponse';
import { NotificationService } from '../services/notification.service';

export class NotificationController {
  /**
   * GET /api/notifications
   */
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 50;
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await NotificationService.list({ limit, unreadOnly });
      return ApiResponse.success(res, 'Notifications fetched successfully.', result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   */
  static async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Invalid notification id.', 400);
      }

      const result = await NotificationService.markRead(id);
      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode || 500);
      }

      return ApiResponse.success(res, result.message!, result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/notifications/read-all
   */
  static async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await NotificationService.markAllRead();
      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode || 500);
      }

      return ApiResponse.success(res, result.message!, result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/notifications/:id
   */
  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) {
        return ApiResponse.error(res, 'Invalid notification id.', 400);
      }

      const result = await NotificationService.delete(id);
      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode || 500);
      }

      return ApiResponse.success(res, result.message!, null, 200);
    } catch (error) {
      next(error);
    }
  }
}
