import { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/inventory.service';
import { ApiResponse } from '../utils/apiResponse';

export class InventoryController {
  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await InventoryService.getPlaceholder();
      ApiResponse.success(res, 'Inventory fetched successfully', data);
    } catch (error) {
      next(error);
    }
  }
}
