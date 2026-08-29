import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

const SHELF_DAYS = 4;

function parseDateParam(raw: string | undefined): { dayStart: Date; dayEnd: Date; ymd: string } | null {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parts = raw.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) return null;
  const dayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  const dayEnd = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
  return { dayStart, dayEnd, ymd: raw };
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = new Date(fromYmd + 'T00:00:00');
  const b = new Date(toYmd + 'T00:00:00');
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

function emptyStock(date: string) {
  return {
    id: null, date,
    milkTotal: 0, lassiProduced: 0, lassiSold: 0, lassiRemaining: 0, lassiDiscarded: 0,
    butterOpening: 0, butterProduced: 0, butterSold: 0, butterConverted: 0, butterClosing: 0, butterDiscarded: 0,
    gheeOpening: 0, gheeProduced: 0, gheeSold: 0, gheeClosing: 0, gheeDiscarded: 0,
    butterOldestDate: null as string | null, gheeOldestDate: null as string | null,
    butterAgeDays: 0, gheeAgeDays: 0, butterExpired: false, gheeExpired: false,
    createdAt: null, updatedAt: null,
  };
}

function withAgeMeta(stock: any, ymd: string) {
  const butterAgeDays = stock.butterOldestDate ? daysBetween(stock.butterOldestDate, ymd) : 0;
  const gheeAgeDays = stock.gheeOldestDate ? daysBetween(stock.gheeOldestDate, ymd) : 0;
  return {
    ...stock,
    butterAgeDays,
    gheeAgeDays,
    butterExpired: Boolean(stock.butterOldestDate) && butterAgeDays >= SHELF_DAYS && (stock.butterClosing || 0) > 0,
    gheeExpired: Boolean(stock.gheeOldestDate) && gheeAgeDays >= SHELF_DAYS && (stock.gheeClosing || 0) > 0,
  };
}

/** Ensure today's F2 row exists, carrying butter/ghee from yesterday (discard if ≥4 days old). */
async function ensureDayStock(dayStart: Date, ymd: string) {
  const existing = await prisma.milkProductDailyStock.findUnique({ where: { date: dayStart } });
  if (existing) return withAgeMeta(existing, ymd);

  const prev = await prisma.milkProductDailyStock.findFirst({
    where: { date: { lt: dayStart } },
    orderBy: { date: 'desc' },
  });

  let butterOpening = 0;
  let butterDiscarded = 0;
  let butterOldestDate: string | null = null;
  let gheeOpening = 0;
  let gheeDiscarded = 0;
  let gheeOldestDate: string | null = null;

  if (prev) {
    const prevButter = money(prev.butterClosing || 0);
    const prevGhee = money(prev.gheeClosing || 0);
    const bOldest = prev.butterOldestDate || null;
    const gOldest = prev.gheeOldestDate || null;

    if (prevButter > 0) {
      if (bOldest && daysBetween(bOldest, ymd) >= SHELF_DAYS) {
        butterDiscarded = prevButter;
        await prisma.milkProductTransaction.create({
          data: {
            date: dayStart, product: 'Butter', type: 'discard',
            quantity: butterDiscarded,
            notes: `Auto-discarded after ${SHELF_DAYS} days (batch ${bOldest})`,
          },
        });
      } else {
        butterOpening = prevButter;
        butterOldestDate = bOldest;
      }
    }

    if (prevGhee > 0) {
      if (gOldest && daysBetween(gOldest, ymd) >= SHELF_DAYS) {
        gheeDiscarded = prevGhee;
        await prisma.milkProductTransaction.create({
          data: {
            date: dayStart, product: 'Ghee', type: 'discard',
            quantity: gheeDiscarded,
            notes: `Auto-discarded after ${SHELF_DAYS} days (batch ${gOldest})`,
          },
        });
      } else {
        gheeOpening = prevGhee;
        gheeOldestDate = gOldest;
      }
    }
  }

  const created = await prisma.milkProductDailyStock.create({
    data: {
      date: dayStart,
      butterOpening,
      butterClosing: butterOpening,
      butterDiscarded,
      butterOldestDate,
      gheeOpening,
      gheeClosing: gheeOpening,
      gheeDiscarded,
      gheeOldestDate,
    },
  });

  return withAgeMeta(created, ymd);
}

/** Deduct milk from F2 milkTotal and main inventory MILK product. */
async function deductMilkForProduction(dayStart: Date, qty: number, label: string) {
  const stock = await prisma.milkProductDailyStock.findUnique({ where: { date: dayStart } });
  if (stock) {
    await prisma.milkProductDailyStock.update({
      where: { date: dayStart },
      data: { milkTotal: money(Math.max(0, (stock.milkTotal || 0) - qty)) },
    });
  }

  const milk =
    (await prisma.inventoryProduct.findFirst({ where: { code: 'MILK' } })) ||
    (await prisma.inventoryProduct.findFirst({ where: { name: { contains: 'milk' } } }));
  if (milk) {
    await prisma.inventoryMovement.create({
      data: {
        productId: milk.id,
        quantity: money(-qty),
        movementType: 'CONVERSION',
        source: `F2 ${label}`,
        reference: `f2-milk-${label.toLowerCase()}-${dayStart.toISOString().slice(0, 10)}-${Date.now()}`,
      },
    });
  }
}

export const getDailyStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = parseDateParam(req.query.date as string);
    if (!range) {
      return ApiResponse.error(res, 'date query param is required and must be YYYY-MM-DD (e.g. 2024-08-25).', 400);
    }
    const stock = await ensureDayStock(range.dayStart, range.ymd);
    return ApiResponse.success(res, 'Daily stock fetched.', stock);
  } catch (err) { next(err); }
};

export const addMilk = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, quantity } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const qty = Number(quantity);
    if (!qty || qty <= 0 || isNaN(qty)) return ApiResponse.error(res, 'quantity must be > 0.', 400);

    await ensureDayStock(range.dayStart, range.ymd);

    const stock = await prisma.milkProductDailyStock.update({
      where: { date: range.dayStart },
      data: { milkTotal: { increment: money(qty) } },
    });

    await prisma.milkProductTransaction.create({
      data: { date: range.dayStart, product: 'Milk', type: 'milk_added', quantity: money(qty) },
    });

    return ApiResponse.success(res, 'Milk added.', withAgeMeta(stock, range.ymd));
  } catch (err) { next(err); }
};

export const addLassiProduction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, quantity } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const qty = Number(quantity);
    if (!qty || qty <= 0 || isNaN(qty)) return ApiResponse.error(res, 'quantity must be > 0.', 400);

    await ensureDayStock(range.dayStart, range.ymd);
    await deductMilkForProduction(range.dayStart, money(qty), 'Lassi');

    const stock = await prisma.milkProductDailyStock.update({
      where: { date: range.dayStart },
      data: {
        lassiProduced: { increment: money(qty) },
        lassiRemaining: { increment: money(qty) },
      },
    });

    await prisma.milkProductTransaction.create({
      data: { date: range.dayStart, product: 'Lassi', type: 'lassi_produced', quantity: money(qty) },
    });

    return ApiResponse.success(res, 'Lassi production recorded.', withAgeMeta(stock, range.ymd));
  } catch (err) { next(err); }
};

export const addButterProduction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, quantity } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const qty = Number(quantity);
    if (!qty || qty <= 0 || isNaN(qty)) return ApiResponse.error(res, 'quantity must be > 0.', 400);

    const current = await ensureDayStock(range.dayStart, range.ymd);
    await deductMilkForProduction(range.dayStart, money(qty), 'Butter');

    const hadStock = (current.butterClosing || 0) > 0;
    const stock = await prisma.milkProductDailyStock.update({
      where: { date: range.dayStart },
      data: {
        butterProduced: { increment: money(qty) },
        butterClosing: { increment: money(qty) },
        // New batch only resets oldest if no prior stock
        ...(hadStock ? {} : { butterOldestDate: range.ymd }),
        ...(!hadStock && !current.butterOldestDate ? { butterOldestDate: range.ymd } : {}),
        ...(!current.butterOldestDate ? { butterOldestDate: range.ymd } : {}),
      },
    });

    await prisma.milkProductTransaction.create({
      data: { date: range.dayStart, product: 'Butter', type: 'butter_produced', quantity: money(qty) },
    });

    return ApiResponse.success(res, 'Butter production recorded.', withAgeMeta(stock, range.ymd));
  } catch (err) { next(err); }
};

export const addGheeProduction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, quantity } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const qty = Number(quantity);
    if (!qty || qty <= 0 || isNaN(qty)) return ApiResponse.error(res, 'quantity must be > 0.', 400);

    const current = await ensureDayStock(range.dayStart, range.ymd);
    await deductMilkForProduction(range.dayStart, money(qty), 'Ghee');

    const stock = await prisma.milkProductDailyStock.update({
      where: { date: range.dayStart },
      data: {
        gheeProduced: { increment: money(qty) },
        gheeClosing: { increment: money(qty) },
        ...(!current.gheeOldestDate ? { gheeOldestDate: range.ymd } : {}),
      },
    });

    await prisma.milkProductTransaction.create({
      data: { date: range.dayStart, product: 'Ghee', type: 'ghee_produced', quantity: money(qty) },
    });

    return ApiResponse.success(res, 'Ghee production recorded.', withAgeMeta(stock, range.ymd));
  } catch (err) { next(err); }
};

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

    await ensureDayStock(range.dayStart, range.ymd);

    const stock = await prisma.$transaction(async (tx) => {
      const current = await tx.milkProductDailyStock.findUnique({ where: { date: range.dayStart } });
      if (!current || current.butterClosing < bKg) {
        throw new Error(`Insufficient butter. Available: ${current?.butterClosing || 0} kg.`);
      }

      const newButterClosing = money(current.butterClosing - bKg);
      const updated = await tx.milkProductDailyStock.update({
        where: { date: range.dayStart },
        data: {
          butterConverted: { increment: money(bKg) },
          butterClosing: newButterClosing,
          butterOldestDate: newButterClosing <= 0 ? null : current.butterOldestDate,
          gheeProduced: { increment: money(gKg) },
          gheeClosing: { increment: money(gKg) },
          gheeOldestDate: current.gheeOldestDate || range.ymd,
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

    return ApiResponse.success(res, 'Butter→Ghee conversion recorded.', withAgeMeta(stock, range.ymd));
  } catch (err: any) {
    if (err?.message?.includes('Insufficient')) return ApiResponse.error(res, err.message, 422);
    next(err);
  }
};

/** Day-end: set sold, discard leftover lassi (same-day only). */
export const setDayEndLassi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, quantity } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);

    const sold = Number(quantity);
    if (isNaN(sold) || sold < 0) return ApiResponse.error(res, 'quantity must be >= 0.', 400);

    await ensureDayStock(range.dayStart, range.ymd);
    const current = await prisma.milkProductDailyStock.findUnique({ where: { date: range.dayStart } });
    const produced = current?.lassiProduced || 0;
    const discarded = money(Math.max(0, produced - sold));

    const stock = await prisma.milkProductDailyStock.update({
      where: { date: range.dayStart },
      data: {
        lassiSold: money(sold),
        lassiRemaining: 0,
        lassiDiscarded: discarded,
      },
    });

    if (discarded > 0) {
      await prisma.milkProductTransaction.create({
        data: {
          date: range.dayStart,
          product: 'Lassi',
          type: 'discard',
          quantity: discarded,
          notes: `Day-end discard: produced ${produced} kg, sold ${sold} kg`,
        },
      });
    }

    return ApiResponse.success(res, 'Day-end lassi set; leftover discarded.', withAgeMeta(stock, range.ymd));
  } catch (err) { next(err); }
};

/** Manual discard for expired butter/ghee (≥4 days). */
export const discardExpired = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, product } = req.body;
    const range = parseDateParam(date);
    if (!range) return ApiResponse.error(res, 'date must be YYYY-MM-DD.', 400);
    if (!['Butter', 'Ghee'].includes(product)) {
      return ApiResponse.error(res, 'product must be Butter or Ghee.', 400);
    }

    await ensureDayStock(range.dayStart, range.ymd);
    const current = await prisma.milkProductDailyStock.findUnique({ where: { date: range.dayStart } });
    if (!current) return ApiResponse.error(res, 'No stock for date.', 404);

    if (product === 'Butter') {
      const qty = money(current.butterClosing || 0);
      if (qty <= 0) return ApiResponse.error(res, 'No butter to discard.', 400);
      const stock = await prisma.milkProductDailyStock.update({
        where: { date: range.dayStart },
        data: {
          butterClosing: 0,
          butterDiscarded: { increment: qty },
          butterOldestDate: null,
        },
      });
      await prisma.milkProductTransaction.create({
        data: { date: range.dayStart, product: 'Butter', type: 'discard', quantity: qty, notes: 'Manual / expired discard' },
      });
      return ApiResponse.success(res, 'Butter discarded.', withAgeMeta(stock, range.ymd));
    }

    const qty = money(current.gheeClosing || 0);
    if (qty <= 0) return ApiResponse.error(res, 'No ghee to discard.', 400);
    const stock = await prisma.milkProductDailyStock.update({
      where: { date: range.dayStart },
      data: {
        gheeClosing: 0,
        gheeDiscarded: { increment: qty },
        gheeOldestDate: null,
      },
    });
    await prisma.milkProductTransaction.create({
      data: { date: range.dayStart, product: 'Ghee', type: 'discard', quantity: qty, notes: 'Manual / expired discard' },
    });
    return ApiResponse.success(res, 'Ghee discarded.', withAgeMeta(stock, range.ymd));
  } catch (err) { next(err); }
};

export const getTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = parseDateParam(req.query.date as string);
    if (!range) {
      return ApiResponse.error(res, 'date query param is required and must be YYYY-MM-DD.', 400);
    }

    const transactions = await prisma.milkProductTransaction.findMany({
      where: { date: { gte: range.dayStart, lte: range.dayEnd } },
      orderBy: { createdAt: 'asc' },
    });

    return ApiResponse.success(res, 'Transactions fetched.', transactions);
  } catch (err) { next(err); }
};

export const getConversions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const range = parseDateParam(req.query.date as string);
    if (!range) {
      return ApiResponse.error(res, 'date query param is required and must be YYYY-MM-DD.', 400);
    }

    const conversions = await prisma.butterGheeConversion.findMany({
      where: { date: { gte: range.dayStart, lte: range.dayEnd } },
      orderBy: { createdAt: 'asc' },
    });

    return ApiResponse.success(res, 'Conversions fetched.', conversions);
  } catch (err) { next(err); }
};

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
        notes: notes || null,
      },
    });

    return ApiResponse.success(res, 'Transaction recorded.', tx, 201);
  } catch (err) { next(err); }
};
