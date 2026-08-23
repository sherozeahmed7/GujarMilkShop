import { Response, NextFunction } from 'express';
import { RateService } from '../services/rate.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class RateController {
  /**
   * Handles POST /api/rates request to add a new price entry.
   * Any authenticated role can update rates.
   */
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
        date
      });

      return ApiResponse.success(
        res,
        result.message,
        result.data,
        result.statusCode
      );
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
   * Returns all standard box prices for Milk and Yogurt dynamically calculated
   * from the latest stored rates in the database.
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
