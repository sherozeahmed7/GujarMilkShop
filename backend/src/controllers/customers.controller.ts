import { Request, Response, NextFunction } from 'express';
import { CustomersService } from '../services/customers.service';
import { ApiResponse } from '../utils/apiResponse';

export class CustomersController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await CustomersService.getPlaceholder();
      ApiResponse.success(res, 'Customers fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
