import { Request, Response, NextFunction } from 'express';
import { SalesService } from '../services/sales.service';
import { ApiResponse } from '../utils/apiResponse';

export class SalesController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SalesService.getPlaceholder();
      ApiResponse.success(res, 'Sales fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
