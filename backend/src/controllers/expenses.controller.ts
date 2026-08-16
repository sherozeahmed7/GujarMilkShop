import { Request, Response, NextFunction } from 'express';
import { ExpensesService } from '../services/expenses.service';
import { ApiResponse } from '../utils/apiResponse';

export class ExpensesController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ExpensesService.getPlaceholder();
      ApiResponse.success(res, 'Expenses fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
