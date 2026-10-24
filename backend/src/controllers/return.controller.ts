import { Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ReturnService } from '../services/return.service';
import { DashboardController } from './dashboard.controller';

export class ReturnController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { fromDate, toDate, customerId, saleIds } = req.query as Record<string, string>;
      const parsedSaleIds = saleIds
        ? saleIds
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n))
        : undefined;

      const result = await ReturnService.list({
        fromDate,
        toDate,
        customerId: customerId ? parseInt(customerId, 10) : undefined,
        saleIds: parsedSaleIds,
      });

      return ApiResponse.success(res, 'Returns fetched.', result.data);
    } catch (e) {
      next(e);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ReturnService.create(
        req.body,
        req.user?.email || 'unknown',
        req.user?.userId
      );

      if (!result.success) {
        return ApiResponse.error(res, result.message || 'Failed to create return.', result.statusCode);
      }
      DashboardController.clearCache();
      return ApiResponse.success(res, result.message || 'Return created.', result.data, result.statusCode);
    } catch (e: any) {
      if (e?.statusCode) {
        return ApiResponse.error(res, e.message || 'Validation failed.', e.statusCode);
      }
      next(e);
    }
  }

  static async lookupBill(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ReturnService.lookupBill(req.params.billNumber);
      if (!result.success) {
        return ApiResponse.error(res, result.message || 'Bill not found.', result.statusCode);
      }
      return ApiResponse.success(res, 'Bill found.', result.data);
    } catch (e) {
      next(e);
    }
  }
}
