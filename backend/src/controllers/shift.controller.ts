import { Response, NextFunction } from 'express';
import { ShiftService } from '../services/shift.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class ShiftController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { return ApiResponse.success(res, 'Shifts fetched successfully', await ShiftService.list(), 200); }
    catch (error) { next(error); }
  }

  static async open(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ShiftService.open(req.user!.userId, Number(req.body.openingCash), req.body.openingNotes);
      return result.success ? ApiResponse.success(res, 'Shift opened successfully', result.data, result.statusCode) : ApiResponse.error(res, result.message!, result.statusCode);
    } catch (error) { next(error); }
  }

  static async close(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await ShiftService.close(req.user!.userId, Number(req.body.countedCash), req.body.closingNotes);
      return result.success ? ApiResponse.success(res, 'Shift closed successfully', result.data, result.statusCode) : ApiResponse.error(res, result.message!, result.statusCode);
    } catch (error) { next(error); }
  }
}