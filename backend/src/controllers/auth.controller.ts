import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../utils/apiResponse';

export class AuthController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AuthService.getPlaceholder();
      ApiResponse.success(res, 'Auth fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
