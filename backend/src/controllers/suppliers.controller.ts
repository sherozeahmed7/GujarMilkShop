import { Request, Response, NextFunction } from 'express';
import { SuppliersService } from '../services/suppliers.service';
import { ApiResponse } from '../utils/apiResponse';

export class SuppliersController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await SuppliersService.getPlaceholder();
      ApiResponse.success(res, 'Suppliers fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
