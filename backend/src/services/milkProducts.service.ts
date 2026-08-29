import { prisma } from '../config/database';

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse a YYYY-MM-DD string into a Date range for that calendar day */
function parseDateRange(dateStr: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date format "${dateStr}". Expected YYYY-MM-DD.`);
  }
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid date "${dateStr}".`);
  }
  const end = new Date(start);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Parse a YYYY-MM-DD string to a single Date (midnight) for unique daily record lookup */
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

export class MilkProductsService {
  /** GET stock for a specific date; returns zeroed record if none exists */
  static async getDailyStock(dateStr: string) {
    parseDateRange(dateStr); // validate
    const dateKey = parseDateKey(dateStr);

    const record = await prisma.milkProductDailyStock.findFirst({
      where: {
        date: {
          gte: new Date(dateKey.setHours(0, 0, 0, 0)),
          lte: new Date(new Date(dateStr).setHours(23, 59, 59, 999)),
        },
      },
    });

    return {
      success: true,
      statusCode: 200,
      data: record ?? ZERO_STOCK(dateStr),
    };
  }

  /** Upsert helper — finds or creates the daily stock row, applies update callback */
  private static async upsertStock(
    dateStr: string,
    updater: (current: ReturnType<typeof ZERO_STOCK>) => Partial<ReturnType<typeof ZERO_STOCK>>
  ) {
    parseDateRange(dateStr); // validate
    const dateKey = parseDateKey(dateStr);

    const existing = await prisma.milkProductDailyStock.findFirst({
      where: {
        date: { gte: dateKey, lte: new Date(new Date(dateStr).setHours(23, 59, 59, 999)) },
      },
    });

    const current = existing ?? ZERO_STOCK(dateStr);
    const updates = updater(current as any);

    if (existing) {
      return prisma.milkProductDailyStock.update({
        where: { id: existing.id },
        data: updates,
      });
    } else {
      const dateOnly = new Date(dateStr);
      dateOnly.setHours(0, 0, 0, 0);
      return prisma.milkProductDailyStock.create({
        data: { date: dateOnly, ...updates } as any,
      });
    }
  }

  /** POST add milk */
  static async addMilk(dateStr: string, quantity: number) {
    if (!quantity || quantity <= 0) {
      return { success: false, statusCode: 400, message: 'quantity must be > 0.' };
    }
    const record = await this.upsertStock(dateStr, (cur) => ({
      milkTotal: money(cur.milkTotal + quantity),
    }));
    await prisma.milkProductTransaction.create({
      data: {
        date: parseDateKey(dateStr),
        product: 'Milk',
        type: 'milk_added',
        quantity,
      },
    });
    return { success: true, statusCode: 200, data: record };
  }

  /** POST lassi production */
  static async addLassiProduction(dateStr: string, quantity: number) {
    if (!quantity || quantity <= 0) {
      return { success: false, statusCode: 400, message: 'quantity must be > 0.' };
    }
    const record = await this.upsertStock(dateStr, (cur) => {
      const produced = money(cur.lassiProduced + quantity);
      const remaining = money(produced - cur.lassiSold);
      return { lassiProduced: produced, lassiRemaining: Math.max(0, remaining) };
    });
    await prisma.milkProductTransaction.create({
      data: { date: parseDateKey(dateStr), product: 'Lassi', type: 'lassi_produced', quantity },
    });
    return { success: true, statusCode: 200, data: record };
  }

  /** POST butter production */
  static async addButterProduction(dateStr: string, quantity: number) {
    if (!quantity || quantity <= 0) {
      return { success: false, statusCode: 400, message: 'quantity must be > 0.' };
    }
    const record = await this.upsertStock(dateStr, (cur) => {
      const produced = money(cur.butterProduced + quantity);
      const closing = money(cur.butterOpening + produced - cur.butterSold - cur.butterConverted);
      return { butterProduced: produced, butterClosing: Math.max(0, closing) };
    });
    await prisma.milkProductTransaction.create({
      data: { date: parseDateKey(dateStr), product: 'Butter', type: 'butter_produced', quantity },
    });
    return { success: true, statusCode: 200, data: record };
  }

  /** POST ghee production */
  static async addGheeProduction(dateStr: string, quantity: number) {
    if (!quantity || quantity <= 0) {
      return { success: false, statusCode: 400, message: 'quantity must be > 0.' };
    }
    const record = await this.upsertStock(dateStr, (cur) => {
      const produced = money(cur.gheeProduced + quantity);
      const closing = money(cur.gheeOpening + produced - cur.gheeSold);
      return { gheeProduced: produced, gheeClosing: Math.max(0, closing) };
    });
    await prisma.milkProductTransaction.create({
      data: { date: parseDateKey(dateStr), product: 'Ghee', type: 'ghee_produced', quantity },
    });
    return { success: true, statusCode: 200, data: record };
  }

  /** POST butter → ghee conversion */
  static async addConversion(dateStr: string, butterKg: number, gheeKg: number, notes?: string) {
    if (!butterKg || butterKg <= 0 || !gheeKg || gheeKg <= 0) {
      return { success: false, statusCode: 400, message: 'butterKg and gheeKg must be > 0.' };
    }
    try {
      const record = await prisma.$transaction(async (tx) => {
        const dateKey = parseDateKey(dateStr);
        const dateOnly = new Date(dateStr);
        dateOnly.setHours(0, 0, 0, 0);

        const existing = await tx.milkProductDailyStock.findFirst({
          where: {
            date: {
              gte: new Date(new Date(dateStr).setHours(0, 0, 0, 0)),
              lte: new Date(new Date(dateStr).setHours(23, 59, 59, 999)),
            },
          },
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
                date: dateOnly,
                butterConverted,
                butterClosing: Math.max(0, butterClosing),
                gheeProduced,
                gheeClosing: Math.max(0, gheeClosing),
              } as any,
            });

        await tx.butterGheeConversion.create({
          data: { date: dateKey, butterUsed: butterKg, gheeProduced: gheeKg, notes: notes ?? null },
        });

        await tx.milkProductTransaction.create({
          data: {
            date: dateKey,
            product: 'Butter',
            type: 'butter_converted',
            quantity: butterKg,
            notes: `Converted to ${gheeKg} kg Ghee`,
          },
        });

        await tx.milkProductTransaction.create({
          data: {
            date: dateKey,
            product: 'Ghee',
            type: 'ghee_produced',
            quantity: gheeKg,
            notes: `Produced from ${butterKg} kg Butter`,
          },
        });

        return updated;
      });

      return { success: true, statusCode: 200, data: record };
    } catch {
      return { success: false, statusCode: 500, message: 'Conversion failed. No changes were saved.' };
    }
  }

  /** POST day-end lassi — set final lassiSold for the day */
  static async setDayEndLassi(dateStr: string, quantity: number) {
    if (quantity === undefined || quantity === null || quantity < 0) {
      return { success: false, statusCode: 400, message: 'quantity must be >= 0.' };
    }
    const record = await this.upsertStock(dateStr, (cur) => {
      const sold = money(quantity);
      const remaining = money(cur.lassiProduced - sold);
      return { lassiSold: sold, lassiRemaining: Math.max(0, remaining) };
    });
    await prisma.milkProductTransaction.create({
      data: { date: parseDateKey(dateStr), product: 'Lassi', type: 'lassi_sold', quantity },
    });
    return { success: true, statusCode: 200, data: record };
  }

  /** GET transactions for a date */
  static async getTransactions(dateStr: string) {
    parseDateRange(dateStr);
    const { start, end } = parseDateRange(dateStr);
    const records = await prisma.milkProductTransaction.findMany({
      where: { date: { gte: start, lte: end } },
      orderBy: { createdAt: 'asc' },
    });
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
    const existing = await tx.milkProductDailyStock.findFirst({
      where: {
        date: {
          gte: new Date(new Date(dateStr).setHours(0, 0, 0, 0)),
          lte: new Date(new Date(dateStr).setHours(23, 59, 59, 999)),
        },
      },
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
    const existing = await prisma.milkProductDailyStock.findFirst({
      where: {
        date: {
          gte: new Date(new Date(dateStr).setHours(0, 0, 0, 0)),
          lte: new Date(new Date(dateStr).setHours(23, 59, 59, 999)),
        },
      },
    });

    return { ok: true as const, record: existing };
  }
}
