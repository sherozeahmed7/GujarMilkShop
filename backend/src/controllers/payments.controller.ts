import { Request, Response, NextFunction } from 'express';
import { PaymentsService } from '../services/payments.service';
import { ApiResponse } from '../utils/apiResponse';

export class PaymentsController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await PaymentsService.getPlaceholder();
      ApiResponse.success(res, 'Payments fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
