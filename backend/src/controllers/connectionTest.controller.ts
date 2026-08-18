import { Request, Response, NextFunction } from 'express';
import { ConnectionTestService } from '../services/connectionTest.service';
import { ApiResponse } from '../utils/apiResponse';

export class ConnectionTestController {
  static async check(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await ConnectionTestService.getSuccessMessage();
      // Send a structured successful API response
      ApiResponse.success(res, 'Connection verified successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
