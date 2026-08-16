import { Request, Response, NextFunction } from 'express';
import { KhataService } from '../services/khata.service';
import { ApiResponse } from '../utils/apiResponse';

export class KhataController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await KhataService.getPlaceholder();
      ApiResponse.success(res, 'Khata fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
