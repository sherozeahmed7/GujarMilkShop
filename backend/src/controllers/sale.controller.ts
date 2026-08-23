import { Response, NextFunction } from 'express';
import { SaleService } from '../services/sale.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class SaleController {
  /**
   * POST /api/sales — Create walk_in | split | ledger sale
   */
  static async createSale(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await SaleService.createSale(req.body);

      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode);
      }

      return ApiResponse.success(res, result.message!, result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/sales — List sales with optional filters
   */
  static async listSales(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const {
        saleType,
        status,
        customerId,
        phone,
        fromDate,
        toDate,
        dateFrom,
        dateTo,
        includeAnalytics
      } = req.query;

      const withAnalytics = includeAnalytics === 'true';

      const result = await SaleService.listSales(
        {
          saleType: saleType as string | undefined,
          status: status as string | undefined,
          customerId: customerId ? Number(customerId) : undefined,
          phone: phone as string | undefined,
          fromDate: fromDate as string | undefined,
          toDate: toDate as string | undefined,
          dateFrom: dateFrom as string | undefined,
          dateTo: dateTo as string | undefined
        },
        withAnalytics
      );

      return ApiResponse.success(
        res,
        withAnalytics ? 'Sales report fetched successfully' : 'Sales fetched successfully',
        result.data,
        200
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/sales/:id — Single sale with items + payments
   */
  static async getSale(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        return ApiResponse.error(res, 'Invalid sale id.', 400);
      }

      const result = await SaleService.getSaleById(id);
      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode);
      }

      return ApiResponse.success(res, 'Sale fetched successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/sales/:id/settle — Settle a split sale's remaining due
   * Body: { paymentMethod: "cash" | "online" }
   */
  static async settleSale(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        return ApiResponse.error(res, 'Invalid sale id.', 400);
      }

      const { paymentMethod } = req.body;
      const result = await SaleService.settleSplitSale(id, paymentMethod);

      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode);
      }

      return ApiResponse.success(res, result.message!, result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }
}
