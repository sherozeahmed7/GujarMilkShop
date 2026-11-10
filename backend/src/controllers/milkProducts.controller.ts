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

    const targetDateStr = (req.query.date as string) || new Date().toISOString().split("T")[0];
    

    const latestRate = await prisma.dailyRate.findFirst({
      orderBy: { id: "desc" },
      select: { milkRate: true, lassiRate: true, butterRate: true, gheeRate: true },
    });
    const daySupplierMilkCost = await prisma.supplierCollection.aggregate({
      where: {
        date: targetDateStr,
        quantity: { gt: 0 },
        rate: { gt: 0 },
      },
      _avg: { rate: true },
    });
    const fallbackSupplierCost = await prisma.supplierCollection.aggregate({
      where: { quantity: { gt: 0 }, rate: { gt: 0 } },
      _avg: { rate: true },
    });

    const milkTotal = Number(stock?.milkTotal ?? 0);
    const milkSellRatePerKg = Number(latestRate?.milkRate ?? 0);
    const milkCostPerKg = money(
      Number(daySupplierMilkCost?._avg?.rate ?? 0) ||
      Number(fallbackSupplierCost._avg.rate ?? 0) ||
      milkSellRatePerKg * 0.65
    );
    const lassiRatePerKg = Number(latestRate?.lassiRate ?? 0);
    const butterRatePerKg = Number(latestRate?.butterRate ?? 0);
    const gheeRatePerKg = Number(latestRate?.gheeRate ?? 0);

    const milkAddedCost = money(milkTotal * milkCostPerKg);

    const butterProduced = Number(stock?.butterProduced ?? 0);
    const lassiProduced = Number(stock?.lassiProduced ?? 0);
    const butterSold = Number(stock?.butterSold ?? 0);
    const lassiSold = Number(stock?.lassiSold ?? 0);
    const butterConverted = Number(stock?.butterConverted ?? 0);
    const gheeProduced = Number(stock?.gheeProduced ?? 0);
    const butterClosing = Math.max(Number(stock?.butterClosing ?? 0), 0);
    const gheeClosing = Math.max(Number(stock?.gheeClosing ?? 0), 0);

    // 1. Butter & Lassi Market Values (use closing stock when no production recorded)
    const effectiveButterKg = butterProduced > 0 ? butterProduced : butterClosing;
    const butterPriceValue = money(effectiveButterKg * butterRatePerKg);
    const lassiPriceValue = money(lassiProduced * lassiRatePerKg);
    const totalButterLassiPrice = money(butterPriceValue + lassiPriceValue);

    // 2. Profit and Loss (Butter + Lassi) = total value - added milk cost
    const butterLassiProfitLoss = milkAddedCost > 0 || totalButterLassiPrice > 0
      ? money(totalButterLassiPrice - milkAddedCost)
      : 0;

    // 3. Cost Allocation proportionally between Butter and Lassi (use effectiveButterKg as denominator)
    let butterCostPerKg = 0;
    let lassiCostPerKg = 0;
    if (totalButterLassiPrice > 0 && milkAddedCost > 0) {
      const butterShare = butterPriceValue / totalButterLassiPrice;
      const lassiShare = lassiPriceValue / totalButterLassiPrice;
      const totalButterCost = money(milkAddedCost * butterShare);
      const totalLassiCost = money(milkAddedCost * lassiShare);
      butterCostPerKg = effectiveButterKg > 0 ? money(totalButterCost / effectiveButterKg) : 0;
      lassiCostPerKg = lassiProduced > 0 ? money(totalLassiCost / lassiProduced) : 0;
    } else if (milkAddedCost > 0 && effectiveButterKg > 0) {
      butterCostPerKg = money(milkAddedCost / effectiveButterKg);
    }

    // 4. Remaining Butter Cost = remaining butter weight * butter cost per kg
    const remainingButterCost = money(butterClosing * butterCostPerKg);

    // 5. Ghee Cost (use gheeClosing when no production recorded)
    const effectiveGheeKg = gheeProduced > 0 ? gheeProduced : gheeClosing;
    const gheeTotalCost = money((butterConverted > 0 ? butterConverted : effectiveGheeKg) * butterCostPerKg);
    const gheeCostPerKg = effectiveGheeKg > 0 ? money(gheeTotalCost / effectiveGheeKg) : 0;
    const gheeTotalSellValue = money(effectiveGheeKg * gheeRatePerKg);
    const gheeClosingSellValue = money(gheeClosing * gheeRatePerKg);
    const gheeClosingCostValue = money(gheeClosing * gheeCostPerKg);

    const lassiBreakEvenKg = lassiRatePerKg > 0 ? Math.round((milkAddedCost / lassiRatePerKg) * 1000) / 1000 : 0;
    const milkRecoveredFromLassi = money(lassiSold * lassiRatePerKg);
    const butterSoldValue = money(butterSold * butterRatePerKg);
    const milkRecoveredFromButter = money(Math.min(butterSoldValue, milkAddedCost));
    const milkRecoveryKgFromButter = milkCostPerKg > 0 ? Math.round((milkRecoveredFromButter / milkCostPerKg) * 1000) / 1000 : 0;
    const milkRemainingKg = Math.max(milkTotal - lassiSold - milkRecoveryKgFromButter, 0);
    const milkLossCost = money(Math.max(milkAddedCost - milkRecoveredFromLassi - milkRecoveredFromButter, 0));
    const butterBreakEvenKg = butterRatePerKg > 0 ? Math.round((milkAddedCost / butterRatePerKg) * 1000) / 1000 : 0;
    const butterBreakEvenCost = milkAddedCost;
    const butterInventoryValue = money(butterClosing * butterRatePerKg);
    const butterTotalValue = money(butterInventoryValue + milkRecoveredFromLassi);
    const butterRecoveryResult = money(butterTotalValue - milkAddedCost);
    const butterMilkCostShortfall = money(Math.max(milkAddedCost - butterInventoryValue, 0));

    return ApiResponse.success(res, "Daily stock fetched.", {
      ...(stock ?? emptyStock(req.query.date as string)),
      milkRatePerKg: milkCostPerKg,
      milkCostPerKg,
      lassiRatePerKg,
      butterRatePerKg,
      gheeRatePerKg,
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
      butterPriceValue,
      lassiPriceValue,
      totalButterLassiPrice,
      butterLassiProfitLoss,
      butterCostPerKg,
      lassiCostPerKg,
      remainingButterCost,
      gheeTotalCost,
      gheeCostPerKg,
      gheeTotalSellValue,
      gheeClosingSellValue,
      gheeClosingCostValue,
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

    const stock = await prisma.$transaction(async (tx) => {
      const updated = await tx.milkProductDailyStock.upsert({
        where:  { date: range.dayStart },
        create: { date: range.dayStart, lassiProduced: money(qty), lassiRemaining: money(qty) },
        update: { lassiProduced: { increment: money(qty) }, lassiRemaining: { increment: money(qty) } },
      });
      await SyncQueueService.enqueueUpdate(tx, 'MilkProductDailyStock', updated.id, updated, 2, 'UPSERT');
      return updated;
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

    const stock = await prisma.$transaction(async (tx) => {
      const updated = await tx.milkProductDailyStock.upsert({
        where:  { date: range.dayStart },
        create: { date: range.dayStart, butterProduced: money(qty), butterClosing: money(qty) },
        update: { butterProduced: { increment: money(qty) }, butterClosing: { increment: money(qty) } },
      });
      await SyncQueueService.enqueueUpdate(tx, 'MilkProductDailyStock', updated.id, updated, 2, 'UPSERT');
      return updated;
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

    const stock = await prisma.$transaction(async (tx) => {
      const updated = await tx.milkProductDailyStock.upsert({
        where:  { date: range.dayStart },
        create: { date: range.dayStart, gheeProduced: money(qty), gheeClosing: money(qty) },
        update: { gheeProduced: { increment: money(qty) }, gheeClosing: { increment: money(qty) } },
      });
      await SyncQueueService.enqueueUpdate(tx, 'MilkProductDailyStock', updated.id, updated, 2, 'UPSERT');
      return updated;
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

    // MilkProductTransaction removed in migration 005. Serve from InventoryMovement.
    const result = await MilkProductsService.getTransactions(req.query.date as string);
    return ApiResponse.success(res, 'Transactions fetched.', result.data);
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
// MilkProductTransaction was consolidated into InventoryMovement (migration 005).
// This endpoint is deprecated and returns 410 Gone.
export const addTransaction = async (req: Request, res: Response, next: NextFunction) => {
  return res.status(410).json({
    success: false,
    message: 'MilkProductTransaction has been removed. Use InventoryMovement directly.',
  });
};
