import { Request, Response, NextFunction } from 'express';
import { ReturnsService } from '../services/returns.service';
import { ApiResponse } from '../utils/apiResponse';

export class ReturnsController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ReturnsService.getPlaceholder();
      ApiResponse.success(res, 'Returns fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
