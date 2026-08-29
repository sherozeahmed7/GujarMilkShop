import { Response, NextFunction } from 'express';
import { RateService } from '../services/rate.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

function parseOptionalRate(value: unknown, fallback = 0): number {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export class RateController {
  /**
   * Handles POST /api/rates request to add a new price entry.
   * Any authenticated role can update rates.
   */
  static async createRate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { milkRate, yogurtRate, lassiRate, butterRate, gheeRate, date } = req.body;

      if (milkRate === undefined || yogurtRate === undefined || !date) {
        return ApiResponse.error(res, 'milkRate, yogurtRate, and date are required fields.', 400);
      }

      const milk = Number(milkRate);
      const yogurt = Number(yogurtRate);
      if (!Number.isFinite(milk) || milk <= 0 || !Number.isFinite(yogurt) || yogurt <= 0) {
        return ApiResponse.error(res, 'milkRate and yogurtRate must be numbers greater than 0.', 400);
      }

      const lassi = parseOptionalRate(lassiRate);
      const butter = parseOptionalRate(butterRate);
      const ghee = parseOptionalRate(gheeRate);
      if (lassi < 0 || butter < 0 || ghee < 0) {
        return ApiResponse.error(res, 'Lassi, butter, and ghee rates cannot be negative.', 400);
      }

      const result = await RateService.addRate({
        milkRate: milk,
        yogurtRate: yogurt,
        ...(lassiRate !== undefined && lassiRate !== null && lassiRate !== ''
          ? { lassiRate: lassi }
          : {}),
        ...(butterRate !== undefined && butterRate !== null && butterRate !== ''
          ? { butterRate: butter }
          : {}),
        ...(gheeRate !== undefined && gheeRate !== null && gheeRate !== ''
          ? { gheeRate: ghee }
          : {}),
        updatedByRole: req.user!.role,
        date,
      });

      return ApiResponse.success(res, result.message, result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles GET /api/rates to fetch all price history and current rates.
   */
  static async getRates(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await RateService.getRates();
      return ApiResponse.success(res, 'Rates fetched successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handles GET /api/rates/standard-prices
   */
  static async getStandardPrices(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await RateService.getStandardPrices();
      return ApiResponse.success(res, 'Standard prices fetched successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }
}
