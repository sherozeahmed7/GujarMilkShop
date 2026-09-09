import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { deductMilkConversion } from '../services/inventory.service';
import { SyncQueueService } from '../services/syncQueue.service';
import { MilkProductsService } from '../services/milkProducts.service';

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse YYYY-MM-DD into day start/end. Returns null if missing or invalid. */
function parseDateParam(raw: string | undefined): { dayStart: Date; dayEnd: Date } | null {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parts = raw.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return null;
  const dayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  const dayEnd   = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
  return { dayStart, dayEnd };
}

/** Zeroed-out stock shape for a date with no record. */
function emptyStock(date: string) {
  return {
    id: null, date,
    milkTotal: 0, lassiProduced: 0, lassiSold: 0, lassiRemaining: 0,
    milkRatePerKg: 0, milkCostPerKg: 0, lassiRatePerKg: 0, butterRatePerKg: 0,
    milkAddedCost: 0, lassiBreakEvenKg: 0, butterBreakEvenKg: 0,
    butterBreakEvenCost: 0, butterInventoryValue: 0, butterMilkCostShortfall: 0,
    milkRemainingKg: 0, milkRecoveredFromLassi: 0, milkLossCost: 0,
    milkRecoveredFromButter: 0, milkRecoveryKgFromButter: 0,
    butterTotalValue: 0, butterRecoveryResult: 0,
    butterOpening: 0, butterProduced: 0, butterSold: 0, butterConverted: 0, butterClosing: 0,
    gheeOpening: 0, gheeProduced: 0, gheeSold: 0, gheeClosing: 0,
    createdAt: null, updatedAt: null,
  };
}

// ─── GET /api/milk-products/stock?date=YYYY-MM-DD ────────────────────────────
export const getDailyStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = parseDateParam(req.query.date as string);
    if (!range) {
      return ApiResponse.error(res, 'date query param is required and must be YYYY-MM-DD (e.g. 2024-08-25).', 400);
    }

    const stockResult = await MilkProductsService.getDailyStock(req.query.date as string);
    const stock = stockResult.data;

    const latestRate = await prisma.dailyRate.findFirst({
      orderBy: { id: 'desc' },
      select: { milkRate: true, lassiRate: true, butterRate: true },
    });
    const supplierMilkCost = await prisma.supplierCollection.aggregate({
      where: { quantity: { gt: 0 }, rate: { gt: 0 } },
      _avg: { rate: true },
    });
    const milkTotal = Number(stock?.milkTotal ?? 0);
    const milkSellRatePerKg = Number(latestRate?.milkRate ?? 0);
    const milkCostPerKg = money(Number(supplierMilkCost._avg.rate ?? 0) || milkSellRatePerKg * 0.65);
    const lassiRatePerKg = Number(latestRate?.lassiRate ?? 0);
    const butterRatePerKg = Number(latestRate?.butterRate ?? 0);
    const milkAddedCost = money(milkTotal * milkCostPerKg);
    const lassiBreakEvenKg = lassiRatePerKg > 0
      ? Math.round((milkAddedCost / lassiRatePerKg) * 1000) / 1000
      : 0;
    const lassiSold = Number(stock?.lassiSold ?? 0);
    const milkRecoveredFromLassi = money(lassiSold * lassiRatePerKg);
    const butterSoldValue = money(Number(stock?.butterSold ?? 0) * butterRatePerKg);
    const milkRecoveredFromButter = money(Math.min(butterSoldValue, milkAddedCost));
    const milkRecoveryKgFromButter = milkCostPerKg > 0
      ? Math.round((milkRecoveredFromButter / milkCostPerKg) * 1000) / 1000
      : 0;
    const milkRemainingKg = Math.max(milkTotal - lassiSold - milkRecoveryKgFromButter, 0);
    const milkLossCost = money(Math.max(milkAddedCost - milkRecoveredFromLassi - milkRecoveredFromButter, 0));
    const butterBreakEvenKg = butterRatePerKg > 0
      ? Math.round((milkAddedCost / butterRatePerKg) * 1000) / 1000
      : 0;
    const butterBreakEvenCost = milkAddedCost;
    const butterInventoryKg = Math.max(Number(stock?.butterClosing ?? 0), 0);
    const butterInventoryValue = money(butterInventoryKg * butterRatePerKg);
    const butterTotalValue = money(butterInventoryValue + milkRecoveredFromLassi);
    const butterRecoveryResult = money(butterTotalValue - milkAddedCost);
    const butterMilkCostShortfall = money(Math.max(milkAddedCost - butterInventoryValue, 0));

    return ApiResponse.success(res, 'Daily stock fetched.', {
      ...(stock ?? emptyStock(req.query.date as string)),
      milkRatePerKg: milkCostPerKg,
      milkCostPerKg,
      lassiRatePerKg,
      butterRatePerKg,
      milkAddedCost,
      lassiBreakEvenKg,
      butterBreakEvenKg,
      butterBreakEvenCost,
      butterInventoryValue,
      butterTotalValue,
      butterRecoveryResult,
      butterMilkCostShortfall,
      milkRemainingKg,
      milkRecoveredFromLassi,
      milkRecoveredFromButter,
      milkRecoveryKgFromButter,
      milkLossCost,
    });
  } catch (err) { next(err); }
};

// ─── POST /api/milk-products/stock/milk ──────────────────────────────────────
export const addMilk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, quantity } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const qty = Number(quantity);
    if (!qty || qty <= 0 || isNaN(qty)) return ApiResponse.error(res, 'quantity must be > 0.', 400);

    const userId = (req as AuthenticatedRequest).user?.userId;
    const dateKey = date as string;
    const ref = `f2-milk-${dateKey}-${Date.now()}`;

    try {
      const stock = await prisma.$transaction(async (tx) => {
        // Milk moved into F2 comes from inventory milk stock
        await deductMilkConversion(tx, {
          milkKg: money(qty),
          reference: ref,
          source: 'F2 milk added (from inventory)',
          userId,
          requireStock: false,
        });

        const updated = await tx.milkProductDailyStock.upsert({
          where: { date: range.dayStart },
          create: { date: range.dayStart, milkTotal: money(qty) },
          update: { milkTotal: { increment: money(qty) } },
        });

        await tx.milkProductTransaction.create({
          data: {
            date: range.dayStart,
            product: 'Milk',
            type: 'milk_added',
            quantity: money(qty),
            reference: ref,
            notes: 'Deducted from inventory milk',
          },
        });

        await SyncQueueService.enqueueUpdate(
          tx,
          'MilkProductDailyStock',
          updated.id,
          updated,
          2,
          'UPSERT'
        );

        return updated;
      });

      return ApiResponse.success(res, 'Milk added (deducted from inventory).', stock);
    } catch (err: any) {
      const msg = err?.message || 'Failed to add milk.';
      if (/not enough milk|milk inventory product not found/i.test(msg)) {
        return ApiResponse.error(res, msg, 422);
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/milk-products/stock/lassi-production ──────────────────────────
export const addLassiProduction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, quantity } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const qty = Number(quantity);
    if (!qty || qty <= 0 || isNaN(qty)) return ApiResponse.error(res, 'quantity must be > 0.', 400);

    const stock = await prisma.milkProductDailyStock.upsert({
      where:  { date: range.dayStart },
      create: { date: range.dayStart, lassiProduced: money(qty), lassiRemaining: money(qty) },
      update: { lassiProduced: { increment: money(qty) }, lassiRemaining: { increment: money(qty) } },
    });

    await prisma.milkProductTransaction.create({
      data: { date: range.dayStart, product: 'Lassi', type: 'lassi_produced', quantity: money(qty) },
    });

    return ApiResponse.success(res, 'Lassi production recorded.', stock);
  } catch (err) { next(err); }
};

// ─── POST /api/milk-products/stock/butter-production ─────────────────────────
export const addButterProduction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, quantity } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const qty = Number(quantity);
    if (!qty || qty <= 0 || isNaN(qty)) return ApiResponse.error(res, 'quantity must be > 0.', 400);

    const stock = await prisma.milkProductDailyStock.upsert({
      where:  { date: range.dayStart },
      create: { date: range.dayStart, butterProduced: money(qty), butterClosing: money(qty) },
      update: { butterProduced: { increment: money(qty) }, butterClosing: { increment: money(qty) } },
    });

    await prisma.milkProductTransaction.create({
      data: { date: range.dayStart, product: 'Butter', type: 'butter_produced', quantity: money(qty) },
    });

    return ApiResponse.success(res, 'Butter production recorded.', stock);
  } catch (err) { next(err); }
};

// ─── POST /api/milk-products/stock/ghee-production ───────────────────────────
export const addGheeProduction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, quantity } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const qty = Number(quantity);
    if (!qty || qty <= 0 || isNaN(qty)) return ApiResponse.error(res, 'quantity must be > 0.', 400);

    const stock = await prisma.milkProductDailyStock.upsert({
      where:  { date: range.dayStart },
      create: { date: range.dayStart, gheeProduced: money(qty), gheeClosing: money(qty) },
      update: { gheeProduced: { increment: money(qty) }, gheeClosing: { increment: money(qty) } },
    });

    await prisma.milkProductTransaction.create({
      data: { date: range.dayStart, product: 'Ghee', type: 'ghee_produced', quantity: money(qty) },
    });

    return ApiResponse.success(res, 'Ghee production recorded.', stock);
  } catch (err) { next(err); }
};

// ─── POST /api/milk-products/stock/conversion ────────────────────────────────
export const addConversion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, butterKg, gheeKg, notes } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const bKg = Number(butterKg);
    const gKg = Number(gheeKg);
    if (!bKg || bKg <= 0 || !gKg || gKg <= 0) {
      return ApiResponse.error(res, 'butterKg and gheeKg must both be > 0.', 400);
    }
    const result = await MilkProductsService.addConversion(date, bKg, gKg, notes);
    if (!result.success) {
      return ApiResponse.error(res, result.message || 'Conversion failed.', result.statusCode);
    }
    return ApiResponse.success(res, 'Butter→Ghee conversion recorded.', result.data);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/milk-products/stock/day-end-lassi ─────────────────────────────
export const setDayEndLassi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, quantity } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const qty = Number(quantity);
    if (isNaN(qty) || qty < 0) return ApiResponse.error(res, 'quantity must be >= 0.', 400);

    const stock = await prisma.milkProductDailyStock.upsert({
      where:  { date: range.dayStart },
      create: { date: range.dayStart, lassiSold: money(qty) },
      update: { lassiSold: money(qty) },
    });

    return ApiResponse.success(res, 'Day-end lassi quantity set.', stock);
  } catch (err) { next(err); }
};

// ─── GET /api/milk-products/transactions?date=YYYY-MM-DD ─────────────────────
export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = parseDateParam(req.query.date as string);
    if (!range) {
      return ApiResponse.error(res, 'date query param is required and must be YYYY-MM-DD.', 400);
    }

    const transactions = await prisma.milkProductTransaction.findMany({
      where:   { date: { gte: range.dayStart, lte: range.dayEnd } },
      orderBy: { createdAt: 'asc' },
    });

    return ApiResponse.success(res, 'Transactions fetched.', transactions);
  } catch (err) { next(err); }
};

// ─── GET /api/milk-products/conversions?date=YYYY-MM-DD ──────────────────────
export const getConversions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = parseDateParam(req.query.date as string);
    if (!range) {
      return ApiResponse.error(res, 'date query param is required and must be YYYY-MM-DD.', 400);
    }

    const conversions = await prisma.butterGheeConversion.findMany({
      where:   { date: { gte: range.dayStart, lte: range.dayEnd } },
      orderBy: { createdAt: 'asc' },
    });

    return ApiResponse.success(res, 'Conversions fetched.', conversions);
  } catch (err) { next(err); }
};

// ─── POST /api/milk-products/transactions ────────────────────────────────────
export const addTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, product, type, quantity, reference, notes } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const qty = Number(quantity);
    if (!qty || qty <= 0) return ApiResponse.error(res, 'quantity must be > 0.', 400);

    const tx = await prisma.milkProductTransaction.create({
      data: {
        date: range.dayStart, product, type,
        quantity: money(qty),
        reference: reference || null,
        notes:     notes     || null,
      },
    });

    return ApiResponse.success(res, 'Transaction recorded.', tx, 201);
  } catch (err) { next(err); }
};
