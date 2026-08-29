import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

function money(n: number) { return Math.round(n * 100) / 100; }

// GET /api/expenses?fromDate=&toDate=&category=
export class ExpenseController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { fromDate, toDate, category } = req.query as Record<string, string>;
      const where: any = {};
      if (category) where.category = category;
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate)   where.date.lte = toDate;
      }
      const expenses = await prisma.expense.findMany({ where, orderBy: { date: 'desc' } });
      // Map DB id (Int) → string for frontend compatibility
      return ApiResponse.success(res, 'Expenses fetched.', expenses.map(e => ({ ...e, id: String(e.id) })));
    } catch (e) { next(e); }
  }

  static async getOne(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const expense = await prisma.expense.findUnique({ where: { id } });
      if (!expense) return ApiResponse.error(res, 'Expense not found.', 404);
      return ApiResponse.success(res, 'Expense fetched.', { ...expense, id: String(expense.id) });
    } catch (e) { next(e); }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { date, category, description, quantity, unitCost, grossLoss, soldRecovery, netExpense, reason, period } = req.body;
      if (!date || !category) return ApiResponse.error(res, 'date and category are required.', 400);
      const addedBy = req.user?.email || 'unknown';
      const amount = money(Number(netExpense) || Number(grossLoss) || 0);
      const expense = await prisma.expense.create({
        data: {
          date, category,
          description: description || null,
          quantity:    money(Number(quantity)    || 0),
          unitCost:    money(Number(unitCost)    || 0),
          grossLoss:   money(Number(grossLoss)   || amount),
          soldRecovery:money(Number(soldRecovery)|| 0),
          netExpense:  amount,
          reason: reason || null,
          period: period || 'once',
          addedBy,
        }
      });
      return ApiResponse.success(res, 'Expense created.', { ...expense, id: String(expense.id) }, 201);
    } catch (e) { next(e); }
  }

  static async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing) return ApiResponse.error(res, 'Expense not found.', 404);
      const { date, category, description, quantity, unitCost, grossLoss, soldRecovery, netExpense, reason } = req.body;
      const updated = await prisma.expense.update({
        where: { id },
        data: {
          ...(date        ? { date }              : {}),
          ...(category    ? { category }          : {}),
          ...(description !== undefined ? { description: description || null } : {}),
          ...(quantity    !== undefined ? { quantity:    money(Number(quantity))     } : {}),
          ...(unitCost    !== undefined ? { unitCost:    money(Number(unitCost))     } : {}),
          ...(grossLoss   !== undefined ? { grossLoss:   money(Number(grossLoss))    } : {}),
          ...(soldRecovery!== undefined ? { soldRecovery:money(Number(soldRecovery)) } : {}),
          ...(netExpense  !== undefined ? { netExpense:  money(Number(netExpense))   } : {}),
          ...(reason      !== undefined ? { reason: reason || null }                  : {}),
        }
      });
      return ApiResponse.success(res, 'Expense updated.', { ...updated, id: String(updated.id) });
    } catch (e) { next(e); }
  }

  static async remove(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const existing = await prisma.expense.findUnique({ where: { id } });
      if (!existing) return ApiResponse.error(res, 'Expense not found.', 404);
      await prisma.expense.delete({ where: { id } });
      return ApiResponse.success(res, 'Expense deleted.', null);
    } catch (e) { next(e); }
  }

  // GET /api/expenses/summary
  static async summary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const expenses = await prisma.expense.findMany();
      const grossLoss  = money(expenses.reduce((s, e) => s + e.grossLoss,   0));
      const netExpense = money(expenses.reduce((s, e) => s + e.netExpense,  0));
      return ApiResponse.success(res, 'Summary fetched.', { stock: 0, avgCost: 0, grossLoss, netExpense });
    } catch (e) { next(e); }
  }

  // GET /api/expenses/breakdown
  static async breakdown(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const yyyyMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const expenses = await prisma.expense.findMany({
        where: { date: { startsWith: yyyyMM } }
      });
      const totalAmount = money(expenses.reduce((s, e) => s + e.netExpense, 0));
      const cats: Record<string, number> = {};
      expenses.forEach(e => { cats[e.category] = money((cats[e.category] || 0) + e.netExpense); });
      const result = Object.entries(cats)
        .map(([category, amount]) => ({
          category, amount,
          percentage: totalAmount > 0 ? Math.round((amount / totalAmount) * 100) : 0
        }))
        .sort((a, b) => b.amount - a.amount);
      return ApiResponse.success(res, 'Breakdown fetched.', result);
    } catch (e) { next(e); }
  }
}
