import { Response, NextFunction } from 'express';
import { SupplierService } from '../services/supplier.service';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const idOf = (value: string) => Number(value);
export class SupplierController {
  static async getNextCode(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const code = await SupplierService.getNextCode();
      return ApiResponse.success(res, 'Next supplier code generated', { code });
    } catch (e) {
      next(e);
    }
  }
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { cycleType, fromDate, toDate, isActive } = req.query;
      const data = await SupplierService.list({
        cycleType: typeof cycleType === 'string' ? cycleType : undefined,
        fromDate: typeof fromDate === 'string' ? fromDate : undefined,
        toDate: typeof toDate === 'string' ? toDate : undefined,
        isActive: isActive !== undefined ? isActive === 'true' || isActive === '1' : undefined,
      });
      return ApiResponse.success(res, 'Suppliers fetched successfully', data);
    } catch (e) {
      next(e);
    }
  }
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { const r = await SupplierService.create(req.body); return r.success ? ApiResponse.success(res, 'Supplier created successfully', r.data, r.statusCode) : ApiResponse.error(res, r.message!, r.statusCode); } catch (e) { next(e); } }
  static async get(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { const r = await SupplierService.get(idOf(req.params.id)); return r.success ? ApiResponse.success(res, 'Supplier fetched successfully', r.data) : ApiResponse.error(res, r.message!, r.statusCode); } catch (e) { next(e); } }
  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { const r = await SupplierService.update(idOf(req.params.id), req.body); return r.success ? ApiResponse.success(res, 'Supplier updated successfully', r.data) : ApiResponse.error(res, r.message!, r.statusCode); } catch (e) { next(e); } }
  static async entries(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { const r = await SupplierService.collections(idOf(req.params.id)); return r.success ? ApiResponse.success(res, 'Supplier entries fetched successfully', r.data) : ApiResponse.error(res, r.message!, r.statusCode); } catch (e) { next(e); } }
  static async listPayments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { fromDate, toDate, supplierId, shiftId, shiftDate, method } = req.query;
      const data = await SupplierService.listPayments({
        fromDate: typeof fromDate === 'string' ? fromDate : undefined,
        toDate: typeof toDate === 'string' ? toDate : undefined,
        supplierId: typeof supplierId === 'string' && supplierId ? Number(supplierId) : undefined,
        shiftId: typeof shiftId === 'string' && shiftId ? Number(shiftId) : undefined,
        shiftDate: typeof shiftDate === 'string' ? shiftDate : undefined,
        method: typeof method === 'string' ? method : undefined,
      });
      return ApiResponse.success(res, 'Supplier payments fetched successfully', data);
    } catch (e) {
      next(e);
    }
  }
  static async collection(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { const r = await SupplierService.saveCollection(req.user!.userId, idOf(req.params.id), req.body, req.body.id ? Number(req.body.id) : undefined); return r.success ? ApiResponse.success(res, 'Collection saved successfully', r.data, r.statusCode) : ApiResponse.error(res, r.message!, r.statusCode); } catch (e) { next(e); } }
  static async deleteCollection(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { const r = await SupplierService.deleteCollection(idOf(req.params.collectionId)); return ApiResponse.success(res, 'Collection deleted successfully', r.data); } catch (e) { next(e); } }
  static async payment(req: AuthenticatedRequest, res: Response, next: NextFunction) { try { const r = await SupplierService.addPayment(req.user!.userId, idOf(req.params.id), req.body); return r.success ? ApiResponse.success(res, 'Supplier payment saved successfully', r.data, r.statusCode) : ApiResponse.error(res, r.message!, r.statusCode); } catch (e) { next(e); } }
}