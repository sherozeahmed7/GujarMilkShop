import { Response, NextFunction } from 'express';
import { RateService } from '../services/rate.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { writeActivityLog } from '../services/activityLog.service';

export class RateController {
  static async createRate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { milkRate, yogurtRate, date } = req.body;

      if (milkRate === undefined || yogurtRate === undefined || !date) {
        return ApiResponse.error(res, 'milkRate, yogurtRate, and date are required fields.', 400);
      }

      const result = await RateService.addRate({
        milkRate: Number(milkRate),
        yogurtRate: Number(yogurtRate),
        updatedByRole: req.user!.role,
        date,
      });

      await writeActivityLog({
        userId: req.user?.userId,
        userName: req.user?.email || 'User',
        userRole: req.user?.role || '',
        module: 'Daily Rates',
        action: 'UPDATE',
        description: `Updated milk rate to ${milkRate} and yogurt rate to ${yogurtRate} (date ${date})`,
        entityId: result.data?.id ? String(result.data.id) : undefined,
      });

      return ApiResponse.success(res, result.message, result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }

  static async getRates(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await RateService.getRates();
      return ApiResponse.success(res, 'Rates fetched successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getStandardPrices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await RateService.getStandardPrices();
      return ApiResponse.success(res, 'Standard prices fetched successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }
}
