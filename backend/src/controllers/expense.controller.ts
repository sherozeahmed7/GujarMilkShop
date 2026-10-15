import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { SyncQueueService } from '../services/syncQueue.service';
import { DashboardController } from './dashboard.controller';

function money(n: number) {
  return Math.round(n * 100) / 100;
}

function mapExpense(e: any) {
  const amount = money(e.amount || e.netExpense || 0);
  const paidAmount = money(e.paidAmount || 0);
  const remaining = money(
    e.remaining !== undefined && e.remaining !== null
      ? e.remaining
      : Math.max(0, amount - paidAmount)
  );
  return {
    ...e,
    id: String(e.id),
    amount,
    paidAmount,
    remaining,
    netExpense: money(e.netExpense || amount),
  };
}

async function openShiftId(): Promise<number | null> {
  const open = await prisma.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { openedAt: 'asc' },
    select: { id: true },
  });
  return open?.id ?? null;
}

export class ExpenseController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { fromDate, toDate, category } = req.query as Record<string, string>;
      const where: any = {};
      if (category) where.category = category;
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate) where.date.lte = toDate;
      }
      const expenses = await prisma.expense.findMany({
        where,
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        include: { payments: { orderBy: { id: 'desc' } } },
      });
      return ApiResponse.success(
        res,
        'Expenses fetched.',
        expenses.map((e) => mapExpense(e))
      );
    } catch (e) {
      next(e);
    }
  }

  static async getOne(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const expense = await prisma.expense.findUnique({
        where: { id },
        include: { payments: { orderBy: { id: 'desc' } } },
      });
      if (!expense) return ApiResponse.error(res, 'Expense not found.', 404);
      return ApiResponse.success(res, 'Expense fetched.', mapExpense(expense));
    } catch (e) {
      next(e);
    }
  }

  /**
   * Simple expense: { date, product/category (text), amount, paidAmount? }
   * Legacy wastage fields still accepted for inventory auto-create.
   * Cash paid out is linked to the currently open shift (expected cash −= paid).
   */
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const body = req.body || {};
      const date = body.date;
      const productText = String(body.product || body.category || body.description || '').trim();
      if (!date || !productText) {
        return ApiResponse.error(res, 'date and product are required.', 400);
      }

      const addedBy = req.user?.email || 'unknown';

      // Prefer simple amount; fall back to netExpense / grossLoss for legacy/inventory
      let amount = money(Number(body.amount));
      if (!Number.isFinite(amount) || amount <= 0) {
        amount = money(Number(body.netExpense) || Number(body.grossLoss) || 0);
      }
      if (!Number.isFinite(amount) || amount < 0) {
        return ApiResponse.error(res, 'amount must be a valid number.', 400);
      }

      // paidAmount: if provided use it; else default to 0 (unpaid)
      const hasExplicitPaid = body.paidAmount !== undefined && body.paidAmount !== null && body.paidAmount !== '';

      let paidAmount = hasExplicitPaid
        ? money(Number(body.paidAmount) || 0)
        : 0;

      if (paidAmount < 0) paidAmount = 0;
      if (paidAmount > amount) {
        return ApiResponse.error(res, 'Paid amount cannot exceed total amount.', 400);
      }

      const remaining = money(Math.max(0, amount - paidAmount));
      const quantity = money(Number(body.quantity) || 0);
      const unitCost = money(Number(body.unitCost) || 0);
      const grossLoss = money(Number(body.grossLoss) || amount);
      const soldRecovery = money(Number(body.soldRecovery) || 0);
      const netExpense = money(Number(body.netExpense) || amount);
      const description =
        body.description?.trim() ||
        (quantity > 0 ? `${productText} — ${quantity} kg` : productText);
      const reason = body.reason?.trim() || null;

      const shiftId = paidAmount > 0 ? await openShiftId() : null;

      const expense = await prisma.$transaction(async (tx) => {
        const created = await tx.expense.create({
          data: {
            date,
            category: productText,
            description,
            quantity,
            unitCost,
            grossLoss,
            soldRecovery,
            netExpense,
            amount,
            paidAmount,
            remaining,
            reason,
            addedBy,
          },
        });

        if (paidAmount > 0) {
          const payment = await tx.expensePayment.create({
            data: {
              expenseId: created.id,
              amount: paidAmount,
              shiftId,
              date,
              addedBy,
            },
          });
          await SyncQueueService.enqueueCreate(tx, 'ExpensePayment', payment.id, payment, 2);
        }

        await SyncQueueService.enqueueCreate(tx, 'Expense', created.id, created, 1);
        return created;
      });

      const full = await prisma.expense.findUnique({
        where: { id: expense.id },
        include: { payments: true },
      });

      DashboardController.clearCache();

      return ApiResponse.success(res, 'Expense created.', mapExpense(full), 201);
    } catch (e) {
      next(e);
    }
  }

  /** POST /expenses/:id/pay — pay toward remaining balance (cash out of open shift) */
  static async pay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const payNow = money(Number(req.body?.amount));
      if (!id || !Number.isFinite(payNow) || payNow <= 0) {
        return ApiResponse.error(res, 'Payment amount must be greater than zero.', 400);
      }

      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing) return ApiResponse.error(res, 'Expense not found.', 404);

      const amount = money(existing.amount || existing.netExpense || 0);
      const alreadyPaid = money(existing.paidAmount || 0);
      const remaining = money(Math.max(0, amount - alreadyPaid));
      if (payNow > remaining) {
        return ApiResponse.error(
          res,
          `Payment cannot exceed remaining Rs. ${remaining}.`,
          400
        );
      }

      const addedBy = req.user?.email || 'unknown';
      const date =
        (typeof req.body?.date === 'string' && req.body.date) ||
        new Date().toISOString().slice(0, 10);
      const shiftId = await openShiftId();

      const updated = await prisma.$transaction(async (tx) => {
        const payment = await tx.expensePayment.create({
          data: { expenseId: id, amount: payNow, shiftId, date, addedBy },
        });
        await SyncQueueService.enqueueCreate(tx, 'ExpensePayment', payment.id, payment, 2);
        const newPaid = money(alreadyPaid + payNow);
        const newRemaining = money(Math.max(0, amount - newPaid));
        const updatedExp = await tx.expense.update({
          where: { id },
          data: { paidAmount: newPaid, remaining: newRemaining },
          include: { payments: { orderBy: { id: 'desc' } } },
        });
        await SyncQueueService.enqueueUpdate(tx, 'Expense', updatedExp.id, updatedExp, 1);
        return updatedExp;
      });

      DashboardController.clearCache();
      return ApiResponse.success(res, 'Payment recorded.', mapExpense(updated));
    } catch (e) {
      next(e);
    }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing) return ApiResponse.error(res, 'Expense not found.', 404);

      const body = req.body || {};
      const productText =
        body.product !== undefined
          ? String(body.product).trim()
          : body.category !== undefined
            ? String(body.category).trim()
            : undefined;

      let amount =
        body.amount !== undefined ? money(Number(body.amount)) : money(existing.amount || existing.netExpense || 0);
      if (body.netExpense !== undefined && body.amount === undefined) {
        amount = money(Number(body.netExpense));
      }

      const existingPaid = money(existing.paidAmount || 0);
      const hasPaidAmount = body.paidAmount !== undefined && body.paidAmount !== null && body.paidAmount !== '';
      const newPaidAmount = hasPaidAmount ? money(Number(body.paidAmount) || 0) : existingPaid;

      if (newPaidAmount < 0) {
        return ApiResponse.error(res, 'Paid amount cannot be negative.', 400);
      }
      if (newPaidAmount > amount) {
        return ApiResponse.error(res, 'Paid amount cannot exceed total amount.', 400);
      }

      const remaining = money(Math.max(0, amount - newPaidAmount));
      const paidDiff = money(newPaidAmount - existingPaid);

      const updated = await prisma.$transaction(async (tx) => {
        // Adjust payments if paid amount changed
        if (paidDiff > 0) {
          // Additional payment paid out now
          const shiftId = await openShiftId();
          const payment = await tx.expensePayment.create({
            data: {
              expenseId: id,
              amount: paidDiff,
              shiftId,
              date: body.date || existing.date,
              addedBy: req.user?.email || 'unknown',
            },
          });
          await SyncQueueService.enqueueCreate(tx, 'ExpensePayment', payment.id, payment, 2);
        } else if (paidDiff < 0) {
          // User reduced paid amount (fixing an overpayment/erroneous payment)
          await tx.expensePayment.deleteMany({ where: { expenseId: id } });
          if (newPaidAmount > 0) {
            const shiftId = await openShiftId();
            const payment = await tx.expensePayment.create({
              data: {
                expenseId: id,
                amount: newPaidAmount,
                shiftId,
                date: body.date || existing.date,
                addedBy: req.user?.email || 'unknown',
              },
            });
            await SyncQueueService.enqueueCreate(tx, 'ExpensePayment', payment.id, payment, 2);
          }
        }

        const updatedExp = await tx.expense.update({
          where: { id },
          data: {
            ...(body.date ? { date: body.date } : {}),
            ...(productText ? { category: productText } : {}),
            ...(body.description !== undefined ? { description: body.description || null } : {}),
            ...(body.quantity !== undefined ? { quantity: money(Number(body.quantity)) } : {}),
            ...(body.unitCost !== undefined ? { unitCost: money(Number(body.unitCost)) } : {}),
            ...(body.grossLoss !== undefined ? { grossLoss: money(Number(body.grossLoss)) } : {}),
            ...(body.soldRecovery !== undefined
              ? { soldRecovery: money(Number(body.soldRecovery)) }
              : {}),
            ...(body.reason !== undefined ? { reason: body.reason || null } : {}),
            amount,
            paidAmount: newPaidAmount,
            remaining,
            netExpense: money(body.netExpense !== undefined ? Number(body.netExpense) : amount),
          },
          include: { payments: true },
        });
        await SyncQueueService.enqueueUpdate(tx, 'Expense', updatedExp.id, updatedExp, 1);
        return updatedExp;
      });

      DashboardController.clearCache();
      return ApiResponse.success(res, 'Expense updated.', mapExpense(updated));
    } catch (e) {
      next(e);
    }
  }

  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing) return ApiResponse.error(res, 'Expense not found.', 404);
      await prisma.$transaction(async (tx) => {
        await tx.expense.delete({ where: { id } });
        await SyncQueueService.enqueueUpdate(tx, 'Expense', id, { id }, 1, 'DELETE');
      });

      DashboardController.clearCache();
      return ApiResponse.success(res, 'Expense deleted.', null);
    } catch (e) {
      next(e);
    }
  }

  static async summary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expenses = await prisma.expense.findMany();
      const grossLoss = money(expenses.reduce((s, e) => s + (e.amount || e.grossLoss || 0), 0));
      const netExpense = money(expenses.reduce((s, e) => s + (e.amount || e.netExpense || 0), 0));
      const paid = money(expenses.reduce((s, e) => s + (e.paidAmount || 0), 0));
      const remaining = money(expenses.reduce((s, e) => s + (e.remaining || 0), 0));
      return ApiResponse.success(res, 'Summary fetched.', {
        stock: 0,
        avgCost: 0,
        grossLoss,
        netExpense,
        paid,
        remaining,
      });
    } catch (e) {
      next(e);
    }
  }

  static async breakdown(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const yyyyMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const expenses = await prisma.expense.findMany({
        where: { date: { startsWith: yyyyMM } },
      });
      const totalAmount = money(expenses.reduce((s, e) => s + (e.amount || e.netExpense || 0), 0));
      const cats: Record<string, number> = {};
      expenses.forEach((e) => {
        cats[e.category] = money((cats[e.category] || 0) + (e.amount || e.netExpense || 0));
      });
      const result = Object.entries(cats)
        .map(([category, amount]) => ({
          category,
          amount,
          percentage: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0,
        }))
        .sort((a, b) => b.amount - a.amount);
      return ApiResponse.success(res, 'Breakdown fetched.', result);
    } catch (e) {
      next(e);
    }
  }
}
