import { Response, NextFunction } from 'express';
import { CustomerService } from '../services/customer.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class CustomerController {
  /**
   * POST /api/customers
   */
  static async createCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await CustomerService.createCustomer(req.body);

      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode);
      }

      return ApiResponse.success(res, result.message!, result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/customers/summary — global stats for summary cards
   * Optional query: scope=ledger → Khata Ledger cards only
   */
  static async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const scope = typeof req.query.scope === 'string' ? req.query.scope : undefined;
      const result = await CustomerService.getCustomersSummary(scope);
      return ApiResponse.success(res, 'Customer summary fetched successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/customers
   * Query: search, dues (true|false), duesStatus (pending|paid|all), customerType, status
   */
  static async listCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { status, customerType, search, dues, duesStatus } = req.query;
      const duesFlag =
        typeof dues === 'string' &&
        ['true', '1', 'yes'].includes(dues.toLowerCase());

      const result = await CustomerService.listCustomers({
        status: status as string | undefined,
        customerType: customerType as string | undefined,
        search: search as string | undefined,
        dues: duesFlag,
        duesStatus: duesStatus as string | undefined
      });

      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode);
      }

      return ApiResponse.success(res, 'Customers fetched successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/customers/:id — soft delete (inactive)
   */
  static async deleteCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        return ApiResponse.error(res, 'Invalid customer id.', 400);
      }

      const result = await CustomerService.deleteCustomer(id);
      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode);
      }

      return ApiResponse.success(res, result.message!, result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/customers/:id
   */
  static async getCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        return ApiResponse.error(res, 'Invalid customer id.', 400);
      }

      const result = await CustomerService.getCustomerById(id);
      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode);
      }

      return ApiResponse.success(res, 'Customer fetched successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/customers/:id
   */
  static async updateCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        return ApiResponse.error(res, 'Invalid customer id.', 400);
      }

      const result = await CustomerService.updateCustomer(id, req.body);
      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode);
      }

      return ApiResponse.success(res, result.message!, result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/customers/:id/status
   * Body: { status: "active" | "inactive" }
   */
  static async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        return ApiResponse.error(res, 'Invalid customer id.', 400);
      }

      const { status } = req.body;
      if (!status) {
        return ApiResponse.error(res, 'status is required.', 400);
      }

      const result = await CustomerService.updateCustomerStatus(id, status);
      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode);
      }

      return ApiResponse.success(res, result.message!, result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/customers/:id/dues
   */
  static async getDues(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        return ApiResponse.error(res, 'Invalid customer id.', 400);
      }

      const result = await CustomerService.getCustomerDues(id);
      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode);
      }

      return ApiResponse.success(res, 'Customer dues fetched successfully', result.data, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/customers/:id/settle-all
   * Body: { paymentMethod: "cash" | "online" }
   * Clears ALL pending/partial sales for the customer.
   */
  static async settleAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      if (!id || Number.isNaN(id)) {
        return ApiResponse.error(res, 'Invalid customer id.', 400);
      }

      const { paymentMethod, amount } = req.body;
      const result = await CustomerService.settleAllDues(id, paymentMethod, amount);

      if (!result.success) {
        return ApiResponse.error(res, result.message!, result.statusCode);
      }

      return ApiResponse.success(res, result.message!, result.data, result.statusCode);
    } catch (error) {
      next(error);
    }
  }
}
