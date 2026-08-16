import { Request, Response, NextFunction } from 'express';
import { ProductsService } from '../services/products.service';
import { ApiResponse } from '../utils/apiResponse';

export class ProductsController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ProductsService.getPlaceholder();
      ApiResponse.success(res, 'Products fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
