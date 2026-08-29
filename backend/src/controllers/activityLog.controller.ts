import { Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ActivityLogService } from '../services/activityLog.service';

function shapeLog(l: {
  id: number;
  createdAt: Date;
  userName: string;
  userRole: string;
  action: string;
  module: string;
  description: string;
  entityId: string | null;
  status: string;
}) {
  return {
    id: String(l.id),
    timestamp: l.createdAt.toISOString(),
    user: l.userName,
    userRole: l.userRole,
    action: l.action,
    module: l.module,
    description: l.description,
    entityId: l.entityId || undefined,
    status: l.status as 'Success' | 'Warning' | 'Error',
  };
}

export class ActivityLogController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = Number(req.query.limit) || 200;
      const logs = await ActivityLogService.list(limit);
      return ApiResponse.success(res, 'Activity logs fetched.', logs.map(shapeLog));
    } catch (e) {
      next(e);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { action, module, description, entityId, status } = req.body || {};
      if (!action || !module || !description) {
        return ApiResponse.error(res, 'action, module, and description are required.', 400);
      }
      const log = await ActivityLogService.create({
        userId: req.user?.userId,
        userName: req.user?.email || 'User',
        userRole: req.user?.role || '',
        action: String(action),
        module: String(module),
        description: String(description),
        entityId: entityId ? String(entityId) : undefined,
        status: status ? String(status) : 'Success',
      });
      return ApiResponse.success(res, 'Activity log recorded.', shapeLog(log), 201);
    } catch (e) {
      next(e);
    }
  }
}
