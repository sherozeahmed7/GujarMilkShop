import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
import { deductMilkConversion } from './inventory.service';
function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse a YYYY-MM-DD string into a Date range for that calendar day (LOCAL time, not UTC) */
function parseDateRange(dateStr: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid date "${dateStr}".`);
  }
  const end = new Date(y, m - 1, d, 23, 59, 59, 999);
  return { start, end };
}

/** Parse a YYYY-MM-DD string to a single Date (local midnight) for unique daily record lookup */
function parseDateKey(dateStr: string): Date {
  const { start } = parseDateRange(dateStr);
  return start;
}

const ZERO_STOCK = (date: string) => ({
  id: 0,
  date: new Date(date),
  milkTotal: 0,
  lassiProduced: 0,
  lassiSold: 0,
  lassiRemaining: 0,
  butterOpening: 0,
  butterProduced: 0,
  butterSold: 0,
  butterConverted: 0,
  butterClosing: 0,
  gheeOpening: 0,
  gheeProduced: 0,
  gheeSold: 0,
  gheeClosing: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
});

/** Resolve core inventory product by code / name (LASSI, BUTTER, GHEE). */
async function findInventoryProduct(tx: any, code: 'LASSI' | 'BUTTER' | 'GHEE') {
  const name = code.toLowerCase();
  let product = await tx.inventoryProduct.findFirst({ where: { code } });
  if (!product) {
    const all = await tx.inventoryProduct.findMany({ where: { isActive: true } });
    product = all.find((p: any) => String(p.name).toLowerCase() === name) || null;
  }
  return product;
}

/**
 * Exact inventory snapshot for one F2 product on a calendar day.
 * Closing = stock as of end of day (all movements up to end).
 * Opening / added / sold / converted derived from inventory movements.
 */
async function inventoryDaySnapshot(
  code: 'LASSI' | 'BUTTER' | 'GHEE',
  dateStr: string
): Promise<{ opening: number; added: number; sold: number; converted: number; closing: number }> {
  const { start, end } = parseDateRange(dateStr);
  const product = await findInventoryProduct(prisma, code);
  if (!product) {
    return { opening: 0, added: 0, sold: 0, converted: 0, closing: 0 };
  }

  const [beforeAgg, dayMoves] = await Promise.all([
    prisma.inventoryMovement.aggregate({
      where: { productId: product.id, date: { lt: start } },
      _sum: { quantity: true },
    }),
    prisma.inventoryMovement.findMany({
      where: { productId: product.id, date: { gte: start, lte: end } },
      select: { quantity: true, movementType: true },
    }),
  ]);

  const opening = money(beforeAgg._sum.quantity || 0);
  let added = 0;
  let sold = 0;
  let converted = 0;
  let dayNet = 0;

  for (const m of dayMoves) {
    const q = Number(m.quantity) || 0;
    dayNet = money(dayNet + q);
    const type = String(m.movementType || '').toUpperCase();
    if (q < 0 && type === 'SALE') {
      sold = money(sold + Math.abs(q));
    } else if (q < 0 && type === 'CONVERSION') {
      converted = money(converted + Math.abs(q));
    } else if (q > 0) {
      // Stock added in inventory (adjustment, production, stock in)
      added = money(added + q);
    }
  }

  return {
    opening,
    added,
    sold,
    converted,
    closing: money(opening + dayNet),
  };
}

export class MilkProductsService {
  /**
   * GET stock for a specific date.
   *
   * Lassi: strictly daily — opening is always 0. Produced and sold come from the
   * milkProductDailyStock record for that calendar date. It does NOT accumulate
   * across days via inventoryDaySnapshot (which would carry yesterday's balance).
   *
   * Butter & Ghee: persist across days — opening = prior days' closing balance
   * from inventoryDaySnapshot (carry-over is correct behaviour).
   *
   * Milk (milkTotal): isolated per calendar date in milkProductDailyStock.
   */
  static async getDailyStock(dateStr: string) {
    const { start, end } = parseDateRange(dateStr);

    const record = await prisma.milkProductDailyStock.findFirst({
      where: { date: { gte: start, lte: end } },
    });

    const base = record ?? ZERO_STOCK(dateStr);

    // Lassi, Butter & Ghee: use inventory snapshot so dynamic inventory adjustments and sales are reflected
    const [lassiInv, butterInv, gheeInv] = await Promise.all([
      inventoryDaySnapshot('LASSI', dateStr),
      inventoryDaySnapshot('BUTTER', dateStr),
      inventoryDaySnapshot('GHEE', dateStr),
    ]);

    // Dynamically derive Lassi produced, sold, and remaining from inventory movements
    const lassiProduced = money(lassiInv.added || Number(base.lassiProduced ?? 0));
    const lassiSold = money(lassiInv.sold || Number(base.lassiSold ?? 0));
    const lassiRemaining = money(lassiInv.closing);

    return {
      success: true,
      statusCode: 200,
      data: {
        ...base,
        // Lassi — daily lifecycle: produced and sold per calendar date, opening = 0
        lassiProduced,
        lassiSold,
        lassiRemaining,
        // Butter — carry-over opening from inventory snapshot
        butterOpening: butterInv.opening,
        butterProduced: butterInv.added,
        butterSold: butterInv.sold,
        butterConverted: butterInv.converted,
        butterClosing: butterInv.closing,
        // Ghee — carry-over opening from inventory snapshot
        gheeOpening: gheeInv.opening,
        gheeProduced: gheeInv.added,
        gheeSold: gheeInv.sold,
        gheeClosing: gheeInv.closing,
      },
    };
  }

  /** Upsert helper — finds or creates the daily stock row, applies update callback */
  private static async upsertStock(
    tx: any,
    dateStr: string,
    updater: (current: ReturnType<typeof ZERO_STOCK>) => Partial<ReturnType<typeof ZERO_STOCK>>
  ) {
    const { start, end } = parseDateRange(dateStr); // local calendar day range
    const dateKey = parseDateKey(dateStr);           // local midnight

    const existing = await tx.milkProductDailyStock.findFirst({
      where: { date: { gte: start, lte: end } },
    });

    const current = existing ?? ZERO_STOCK(dateStr);
    const updates = updater(current as any);

    if (existing) {
      return tx.milkProductDailyStock.update({
        where: { id: existing.id },
        data: updates,
      });
    } else {
      const created = await tx.milkProductDailyStock.create({
        data: { date: dateKey, ...updates } as any,
      });
      await SyncQueueService.createCloudMapping('MilkProductDailyStock', created.id, undefined, tx);
      return created;
    }
  }

  /** POST add milk — also deducts the same kg from inventory milk */
  static async addMilk(dateStr: string, quantity: number, userId?: number) {
    if (!quantity || quantity <= 0) {
      return { success: false, statusCode: 400, message: 'quantity must be > 0.' };
    }
    const qty = money(quantity);
    const ref = `f2-milk-${dateStr}-${Date.now()}`;
    try {
      const record = await prisma.$transaction(async (tx) => {
        await deductMilkConversion(tx, {
          milkKg: qty,
          reference: ref,
          source: 'F2 milk added (from inventory)',
          userId,
          requireStock: false,
        });
        const updated = await this.upsertStock(tx, dateStr, (cur) => ({
          milkTotal: money(cur.milkTotal + qty),
        }));
        await SyncQueueService.enqueueUpdate(tx, 'MilkProductDailyStock', updated.id, updated, 2, 'UPSERT');
        return updated;
      });
      return { success: true, statusCode: 200, data: record };
    } catch (err: any) {
      const msg = err?.message || 'Failed to add milk.';
      if (/not enough milk|milk inventory product not found/i.test(msg)) {
        return { success: false, statusCode: 422, message: msg };
      }
      throw err;
    }
  }

  /** POST lassi production */
  static async addLassiProduction(dateStr: string, quantity: number) {
    if (!quantity || quantity <= 0) {
      return { success: false, statusCode: 400, message: 'quantity must be > 0.' };
    }
    const record = await prisma.$transaction(async (tx) => {
      const updated = await this.upsertStock(tx, dateStr, (cur) => {
        const produced = money(cur.lassiProduced + quantity);
        const remaining = money(produced - cur.lassiSold);
        return { lassiProduced: produced, lassiRemaining: Math.max(0, remaining) };
      });
      await SyncQueueService.enqueueUpdate(tx, 'MilkProductDailyStock', updated.id, updated, 2, 'UPSERT');
      return updated;
    });
    return { success: true, statusCode: 200, data: record };
  }

  /** POST butter production */
  static async addButterProduction(dateStr: string, quantity: number) {
    if (!quantity || quantity <= 0) {
      return { success: false, statusCode: 400, message: 'quantity must be > 0.' };
    }
    const record = await prisma.$transaction(async (tx) => {
      const updated = await this.upsertStock(tx, dateStr, (cur) => {
        const produced = money(cur.butterProduced + quantity);
        const closing = money(cur.butterOpening + produced - cur.butterSold - cur.butterConverted);
        return { butterProduced: produced, butterClosing: Math.max(0, closing) };
      });
      await SyncQueueService.enqueueUpdate(tx, 'MilkProductDailyStock', updated.id, updated, 2, 'UPSERT');
      return updated;
    });
    return { success: true, statusCode: 200, data: record };
  }

  /** POST ghee production */
  static async addGheeProduction(dateStr: string, quantity: number) {
    if (!quantity || quantity <= 0) {
      return { success: false, statusCode: 400, message: 'quantity must be > 0.' };
    }
    const record = await prisma.$transaction(async (tx) => {
      const updated = await this.upsertStock(tx, dateStr, (cur) => {
        const produced = money(cur.gheeProduced + quantity);
        const closing = money(cur.gheeOpening + produced - cur.gheeSold);
        return { gheeProduced: produced, gheeClosing: Math.max(0, closing) };
      });
      await SyncQueueService.enqueueUpdate(tx, 'MilkProductDailyStock', updated.id, updated, 2, 'UPSERT');
      return updated;
    });
    return { success: true, statusCode: 200, data: record };
  }

  /** POST butter → ghee conversion — updates F2 daily stock AND Inventory */
  static async addConversion(dateStr: string, butterKg: number, gheeKg: number, notes?: string) {
    if (!butterKg || butterKg <= 0 || !gheeKg || gheeKg <= 0) {
      return { success: false, statusCode: 400, message: 'butterKg and gheeKg must be > 0.' };
    }
    try {
      const record = await prisma.$transaction(async (tx) => {
        const { start, end } = parseDateRange(dateStr);
        const dateKey = parseDateKey(dateStr);

        const butterProduct = await findInventoryProduct(tx, 'BUTTER');
        const gheeProduct = await findInventoryProduct(tx, 'GHEE');
        if (!butterProduct) {
          throw new Error('Butter inventory product not found. Add Butter in Inventory first.');
        }
        if (!gheeProduct) {
          throw new Error('Ghee inventory product not found. Add Ghee in Inventory first.');
        }

        const butterBal =
          (
            await tx.inventoryMovement.aggregate({
              where: { productId: butterProduct.id },
              _sum: { quantity: true },
            })
          )._sum.quantity || 0;
        if (butterBal < butterKg) {
          throw new Error(
            `Not enough Butter in Inventory. Available ${money(butterBal)} kg, need ${money(butterKg)} kg.`
          );
        }

        const existing = await tx.milkProductDailyStock.findFirst({
          where: { date: { gte: start, lte: end } },
        });
        const cur = existing ?? ZERO_STOCK(dateStr);

        const butterConverted = money((cur as any).butterConverted + butterKg);
        const butterClosing = money(
          (cur as any).butterOpening + (cur as any).butterProduced - (cur as any).butterSold - butterConverted
        );
        const gheeProduced = money((cur as any).gheeProduced + gheeKg);
        const gheeClosing = money((cur as any).gheeOpening + gheeProduced - (cur as any).gheeSold);

        const updated = existing
          ? await tx.milkProductDailyStock.update({
              where: { id: existing.id },
              data: {
                butterConverted,
                butterClosing: Math.max(0, butterClosing),
                gheeProduced,
                gheeClosing: Math.max(0, gheeClosing),
              },
            })
          : await tx.milkProductDailyStock.create({
              data: {
                date: dateKey,
                butterConverted,
                butterClosing: Math.max(0, butterClosing),
                gheeProduced,
                gheeClosing: Math.max(0, gheeClosing),
              } as any,
            });

        const conversion = await tx.butterGheeConversion.create({
          data: { date: dateKey, butterUsed: butterKg, gheeProduced: gheeKg, notes: notes ?? null },
        });
        await SyncQueueService.enqueueCreate(tx, 'ButterGheeConversion', conversion.id, conversion, 3);

        const ts = Date.now();
        const butterMove = await tx.inventoryMovement.create({
          data: {
            productId: butterProduct.id,
            quantity: money(-butterKg),
            movementType: 'CONVERSION',
            source: 'Butter → Ghee conversion',
            reference: `f2-conv-butter-${dateStr}-${ts}`,
            date: new Date(),
          },
        });
        const gheeMove = await tx.inventoryMovement.create({
          data: {
            productId: gheeProduct.id,
            quantity: money(gheeKg),
            movementType: 'CONVERSION',
            source: 'Butter → Ghee conversion',
            reference: `f2-conv-ghee-${dateStr}-${ts}`,
            date: new Date(),
          },
        });
        await SyncQueueService.enqueueCreate(tx, 'InventoryMovement', butterMove.id, butterMove, 2);
        await SyncQueueService.enqueueCreate(tx, 'InventoryMovement', gheeMove.id, gheeMove, 2);



        await SyncQueueService.enqueueUpdate(tx, 'MilkProductDailyStock', updated.id, updated, 2, 'UPSERT');
        return updated;
      });

      // Return inventory-backed snapshot so UI matches Inventory immediately
      const snap = await this.getDailyStock(dateStr);
      return { success: true, statusCode: 200, data: snap.data };
    } catch (err: any) {
      const msg = err?.message || 'Conversion failed. No changes were saved.';
      if (/not enough butter|inventory product not found/i.test(msg)) {
        return { success: false, statusCode: 422, message: msg };
      }
      return { success: false, statusCode: 500, message: msg };
    }
  }

  /** POST day-end lassi — set final lassiSold for the day */
  static async setDayEndLassi(dateStr: string, quantity: number) {
    if (quantity === undefined || quantity === null || quantity < 0) {
      return { success: false, statusCode: 400, message: 'quantity must be >= 0.' };
    }
    const record = await prisma.$transaction(async (tx) => {
      const updated = await this.upsertStock(tx, dateStr, (cur) => {
        const sold = money(quantity);
        const remaining = money(cur.lassiProduced - sold);
        return { lassiSold: sold, lassiRemaining: Math.max(0, remaining) };
      });
      await SyncQueueService.enqueueUpdate(tx, 'MilkProductDailyStock', updated.id, updated, 2, 'UPSERT');
      return updated;
    });
    return { success: true, statusCode: 200, data: record };
  }

    /**
   * GET F2 movement history for a date.
   * Reads from InventoryMovement (source of truth) for LASSI, BUTTER, GHEE.
   * MilkProductTransaction was removed in migration 005.
   */
  static async getTransactions(dateStr: string) {
    const { start, end } = parseDateRange(dateStr);
    const products = await prisma.inventoryProduct.findMany({
      where: { code: { in: ['LASSI', 'BUTTER', 'GHEE', 'MILK'] } },
      select: { id: true, code: true, name: true },
    });
    const productIds = products.map((p) => p.id);
    const productMap: Record<number, string> = {};
    for (const p of products) productMap[p.id] = p.code ?? p.name;

    const movements = await prisma.inventoryMovement.findMany({
      where: { productId: { in: productIds }, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
      select: { id: true, productId: true, quantity: true, movementType: true, source: true, reference: true, date: true, createdAt: true },
    });

    const records = movements.map((m) => ({
      id: m.id,
      date: m.date,
      product: productMap[m.productId] ?? 'UNKNOWN',
      type: m.movementType,
      quantity: Math.abs(Number(m.quantity)),
      direction: Number(m.quantity) >= 0 ? 'IN' : 'OUT',
      reference: m.reference,
      source: m.source,
      createdAt: m.createdAt,
    }));

    return { success: true, statusCode: 200, data: records };
  }

  /** GET conversions for a date */
  static async getConversions(dateStr: string) {
    parseDateRange(dateStr);
    const { start, end } = parseDateRange(dateStr);
    const records = await prisma.butterGheeConversion.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
    });
    return { success: true, statusCode: 200, data: records };
  }

  /**
   * Called by sale.service when an F2 item is sold.
   * Deducts sold quantities from today's stock inside the given Prisma transaction.
   */
  static async deductStockInTransaction(
    tx: any,
    dateStr: string,
    lassiQty: number,
    butterQty: number,
    gheeQty: number
  ) {
    const { start, end } = parseDateRange(dateStr);
    const existing = await tx.milkProductDailyStock.findFirst({
      where: { date: { gte: start, lte: end } },
    });

    if (!existing) {
      throw new Error('No stock record exists for today. Cannot deduct F2 stock.');
    }

    const updates: any = {};
    if (lassiQty > 0) {
      updates.lassiSold = money(existing.lassiSold + lassiQty);
      updates.lassiRemaining = money(existing.lassiRemaining - lassiQty);
    }
    if (butterQty > 0) {
      updates.butterSold = money(existing.butterSold + butterQty);
      updates.butterClosing = money(existing.butterClosing - butterQty);
    }
    if (gheeQty > 0) {
      updates.gheeSold = money(existing.gheeSold + gheeQty);
      updates.gheeClosing = money(existing.gheeClosing - gheeQty);
    }

    if (Object.keys(updates).length > 0) {
      await tx.milkProductDailyStock.update({ where: { id: existing.id }, data: updates });
    }
  }

  /** Stock check — optional helper; sales no longer block on zero F2 stock */
  static async checkF2Stock(dateStr: string, lassiQty: number, butterQty: number, gheeQty: number) {
    const { start, end } = parseDateRange(dateStr);
    const existing = await prisma.milkProductDailyStock.findFirst({
      where: { date: { gte: start, lte: end } },
    });

    return { ok: true as const, record: existing };
  }
}
