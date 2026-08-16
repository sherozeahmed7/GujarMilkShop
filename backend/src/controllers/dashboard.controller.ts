import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { ApiResponse } from '../utils/apiResponse';

export class DashboardController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await DashboardService.getPlaceholder();
      ApiResponse.success(res, 'Dashboard fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
