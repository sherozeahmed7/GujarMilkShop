import { Request, Response, NextFunction } from 'express';
import { MilkPurchasesService } from '../services/milkPurchases.service';
import { ApiResponse } from '../utils/apiResponse';

export class MilkPurchasesController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await MilkPurchasesService.getPlaceholder();
      ApiResponse.success(res, 'MilkPurchases fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
