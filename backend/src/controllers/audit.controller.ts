import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

function formatAudit(a: any) {
  return {
    ...a,
    id: String(a.id),
    matched:    JSON.parse(a.matched    || '[]'),
    missing:    JSON.parse(a.missing    || '[]'),
    extra:      JSON.parse(a.extra      || '[]'),
    duplicates: JSON.parse(a.duplicates || '[]'),
    executedAt: a.executedAt?.toISOString?.() ?? a.executedAt,
    createdAt:  a.createdAt?.toISOString?.()  ?? a.createdAt,
  };
}

export class AuditController {
  // GET /api/audits — list all past audits
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const audits = await prisma.auditRecord.findMany({ orderBy: { executedAt: 'desc' } });
      return ApiResponse.success(res, 'Audits fetched.', audits.map(formatAudit));
    } catch (e) { next(e); }
  }

  // POST /api/audits — save a new audit result
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const {
        auditDate, totalPosBills, collectedReceipts,
        matched, missing, extra, duplicates, status, notes,
      } = req.body;

      if (!auditDate || !status) {
        return ApiResponse.error(res, 'auditDate and status are required.', 400);
      }

      const auditedBy = req.user?.email || 'unknown';

      const audit = await prisma.auditRecord.create({
        data: {
          auditDate,
          totalPosBills:     Number(totalPosBills)     || 0,
          collectedReceipts: Number(collectedReceipts) || 0,
          matched:    JSON.stringify(matched    || []),
          missing:    JSON.stringify(missing    || []),
          extra:      JSON.stringify(extra      || []),
          duplicates: JSON.stringify(duplicates || []),
          status,
          notes: notes || '',
          auditedBy,
        },
      });
      return ApiResponse.success(res, 'Audit saved.', formatAudit(audit), 201);
    } catch (e) { next(e); }
  }

  // GET /api/audits/bills?date=YYYY-MM-DD — get real sale bill numbers for a given date
  static async getBillsForDate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { date } = req.query as { date: string };
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return ApiResponse.error(res, 'date query param is required (YYYY-MM-DD).', 400);
      }
      const d = new Date(date);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
      const dayEnd   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

      const sales = await prisma.sale.findMany({
        where: { createdAt: { gte: dayStart, lte: dayEnd } },
        select: { id: true },
        orderBy: { id: 'asc' },
      });

      const bills = sales.map(s => ({ billNumber: String(s.id), date }));
      return ApiResponse.success(res, 'Bills fetched.', bills);
    } catch (e) { next(e); }
  }
}
