import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';

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

    const stock = await prisma.milkProductDailyStock.findFirst({
      where: { date: { gte: range.dayStart, lte: range.dayEnd } },
    });

    return ApiResponse.success(res, 'Daily stock fetched.', stock ?? emptyStock(req.query.date as string));
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

    const stock = await prisma.milkProductDailyStock.upsert({
      where:  { date: range.dayStart },
      create: { date: range.dayStart, milkTotal: money(qty) },
      update: { milkTotal: { increment: money(qty) } },
    });

    await prisma.milkProductTransaction.create({
      data: { date: range.dayStart, product: 'Milk', type: 'milk_added', quantity: money(qty) },
    });

    return ApiResponse.success(res, 'Milk added.', stock);
  } catch (err) { next(err); }
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

    const stock = await prisma.$transaction(async (tx) => {
      const updated = await tx.milkProductDailyStock.upsert({
        where:  { date: range.dayStart },
        create: {
          date: range.dayStart,
          butterConverted: money(bKg), butterClosing: money(-bKg),
          gheeProduced:    money(gKg), gheeClosing:   money(gKg),
        },
        update: {
          butterConverted: { increment: money(bKg) },
          butterClosing:   { decrement: money(bKg) },
          gheeProduced:    { increment: money(gKg) },
          gheeClosing:     { increment: money(gKg) },
        },
      });

      await tx.butterGheeConversion.create({
        data: { date: range.dayStart, butterUsed: money(bKg), gheeProduced: money(gKg), notes: notes || null },
      });

      await tx.milkProductTransaction.create({
        data: { date: range.dayStart, product: 'Butter', type: 'butter_converted', quantity: money(bKg), notes: `Converted to ${gKg} kg Ghee` },
      });
      await tx.milkProductTransaction.create({
        data: { date: range.dayStart, product: 'Ghee', type: 'ghee_produced', quantity: money(gKg), notes: `Produced from ${bKg} kg Butter` },
      });

      return updated;
    });

    return ApiResponse.success(res, 'Butter→Ghee conversion recorded.', stock);
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
