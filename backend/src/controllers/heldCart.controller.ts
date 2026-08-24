import { Response, NextFunction } from 'express';
import { HeldCartService } from '../services/heldCart.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class HeldCartController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await HeldCartService.create(req.user!.userId, req.body);
      if (!result.success) return ApiResponse.error(res, result.message!, result.statusCode);
      return ApiResponse.success(res, 'Bill held successfully.', result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }

  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await HeldCartService.list(req.user!.userId);
      return ApiResponse.success(res, 'Held bills fetched successfully.', data, 200);
    } catch (error) {
      next(error);
    }
  }

  static async resume(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return ApiResponse.error(res, 'Invalid held bill id.', 400);

      const result = await HeldCartService.resume(req.user!.userId, id);
      if (!result.success) return ApiResponse.error(res, result.message!, result.statusCode);
      return ApiResponse.success(res, 'Held bill resumed successfully.', result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id) || id <= 0) return ApiResponse.error(res, 'Invalid held bill id.', 400);

      const result = await HeldCartService.remove(req.user!.userId, id);
      if (!result.success) return ApiResponse.error(res, result.message!, result.statusCode);
      return ApiResponse.success(res, 'Held bill deleted successfully.', result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }
}
