import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
const MOVEMENT_TYPES = ['OPENING', 'STOCK_IN', 'SALE', 'RETURN', 'WASTAGE', 'ADJUSTMENT', 'CONVERSION'];
const money = (value: number) => Math.round(value * 100) / 100;

function rateFor(
  name: string,
  rate: {
    milkRate: number;
    yogurtRate: number;
    lassiRate?: number;
    butterRate?: number;
    gheeRate?: number;
  } | null
) {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes('milk')) return rate?.milkRate || 0;
  if (normalized.includes('yogurt') || normalized === 'yog') return rate?.yogurtRate || 0;
  if (normalized.includes('lassi')) return rate?.lassiRate || 0;
  if (normalized.includes('butter')) return rate?.butterRate || 0;
  if (normalized.includes('ghee')) return rate?.gheeRate || 0;
  return 0;
}

async function averageSupplierCost(name: string) {
  const normalized = name.trim().toLowerCase();
  const costs = normalized.includes('milk')
    ? (await prisma.supplierCollection.findMany({ select: { rate: true }, where: { quantity: { gt: 0 }, rate: { gt: 0 } } })).map((entry) => entry.rate)
    : (await prisma.inventoryMovement.findMany({ where: { movementType: 'STOCK_IN', unitCost: { gt: 0 }, product: { name: { equals: name } } }, select: { unitCost: true } })).map((entry) => entry.unitCost || 0);
  return costs.length ? money(costs.reduce((sum, cost) => sum + cost, 0) / costs.length) : 0;
}

/** Only core Milk / Yogurt stock losses feed the Expenses screen. */
function milkOrYogurtExpenseCategory(name: string): 'Milk' | 'Yogurt' | null {
  const normalized = name.trim().toLowerCase();
  if (normalized === 'milk') return 'Milk';
  if (normalized === 'yogurt' || normalized === 'yog') return 'Yogurt';
  return null;
}

/** Yogurt / Lassi are made from milk — 1 kg product uses 1 kg milk until a configurable ratio exists. */
export const MILK_PER_KG_YOGURT = 1;
export const MILK_PER_KG_LASSI = 1;

function isYogurtProduct(product: { code?: string | null; name?: string | null }): boolean {
  const code = String(product.code || '').toUpperCase();
  const name = String(product.name || '').trim().toLowerCase();
  return code === 'YOGURT' || name === 'yogurt' || name === 'yog';
}

/**
 * Deduct milk inventory for a conversion (yogurt stock-in, lassi sale, etc.).
 * Returns null if milk product missing or qty is 0; throws Error with message on hard failure when requireStock.
 */
export async function deductMilkConversion(
  tx: any,
  opts: {
    milkKg: number;
    reference: string;
    source: string;
    userId?: number;
    shiftId?: number | null;
    /** When true, refuse if milk stock would go below zero */
    requireStock?: boolean;
  }
): Promise<{ id: number } | null> {
  const milkKg = money(opts.milkKg);
  if (!(milkKg > 0)) return null;

  const existing = await tx.inventoryMovement.findUnique({ where: { reference: opts.reference } });
  if (existing) return existing;

  let milkProduct = await tx.inventoryProduct.findFirst({ where: { code: 'MILK' } });
  if (!milkProduct) {
    const all = await tx.inventoryProduct.findMany({ where: { isActive: true } });
    milkProduct = all.find((p: any) => String(p.name).trim().toLowerCase() === 'milk') || null;
  }
  if (!milkProduct) {
    throw new Error('Milk inventory product not found. Cannot convert milk.');
  }

  const current =
    (
      await tx.inventoryMovement.aggregate({
        where: { productId: milkProduct.id },
        _sum: { quantity: true },
      })
    )._sum.quantity || 0;

  if (opts.requireStock && current < milkKg) {
    throw new Error(
      `Not enough milk stock. Need ${milkKg} kg but only ${money(current)} kg available.`
    );
  }

  const movement = await tx.inventoryMovement.create({
    data: {
      productId: milkProduct.id,
      quantity: money(-milkKg),
      movementType: 'CONVERSION',
      source: opts.source,
      reference: opts.reference,
      userId: opts.userId,
      shiftId: opts.shiftId ?? null,
    },
  });
  await SyncQueueService.enqueueCreate(tx, 'InventoryMovement', movement.id, movement, 2);
  return movement;
}

function toDateOnly(value: Date): string {
  const yyyy = value.getFullYear();
  const mm = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export class InventoryService {
  static async currentRate() {
    return prisma.dailyRate.findFirst({
      orderBy: { id: 'desc' },
      select: {
        milkRate: true,
        yogurtRate: true,
        lassiRate: true,
        butterRate: true,
        gheeRate: true,
      },
    });
  }

  static async productView(product: any, movements: any[] = [], rate: any = null) {
    const stock = money(movements.reduce((sum, movement) => sum + movement.quantity, 0));
    const costRows = movements.filter((movement) => movement.unitCost !== null && movement.unitCost > 0);
    const cost = costRows.length ? money(costRows.reduce((sum, movement) => sum + movement.unitCost, 0) / costRows.length) : 0;
    const sellPrice = rateFor(product.name, rate);
    const status = stock <= 0 ? 'Out of Stock' : stock <= product.lowStockThreshold ? 'Warning: Low' : 'In Stock';
    return { ...product, stock, cost, sellPrice, status, tags: [] };
  }

  static async list(search?: string) {
    const products = await prisma.inventoryProduct.findMany({ where: { isActive: true, ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }, { description: { contains: search } }] } : {}) }, orderBy: { name: 'asc' } });
    const rate = await this.currentRate();
    return Promise.all(products.map(async (product) => this.productView(product, await prisma.inventoryMovement.findMany({ where: { productId: product.id }, select: { quantity: true, unitCost: true } }), rate)));
  }

  static async get(id: number) {
    const product = await prisma.inventoryProduct.findUnique({ where: { id } });
    if (!product) return { success: false, statusCode: 404, message: 'Product not found.' };
    const [movements, rate] = await Promise.all([
      prisma.inventoryMovement.findMany({ where: { productId: id }, select: { quantity: true, unitCost: true } }),
      this.currentRate(),
    ]);
    return { success: true, statusCode: 200, data: await this.productView(product, movements, rate) };
  }

  static async summary() {
    const products = await this.list();
    return {
      totalProducts: products.length,
      stockValue: money(products.reduce((sum, product) => sum + product.stock * product.cost, 0)),
      lowStockCount: products.filter((product) => product.status === 'Warning: Low').length,
      outOfStockCount: products.filter((product) => product.status === 'Out of Stock').length,
    };
  }

  static async createProduct(payload: any) {
    if (!payload.code?.trim() || !payload.name?.trim() || !payload.unit?.trim()) return { success: false, statusCode: 400, message: 'Product code, name, and unit are required.' };
    const rate = await this.currentRate();
    if (rateFor(payload.name, rate) <= 0) return { success: false, statusCode: 422, message: 'Selling price is not configured in Daily Rates for this product.' };
    if (await averageSupplierCost(payload.name) <= 0) return { success: false, statusCode: 422, message: 'No supplier cost is available for this product.' };
    try {
      const product = await prisma.$transaction(async (tx) => {
        const created = await tx.inventoryProduct.create({ data: { code: payload.code.trim().toUpperCase(), name: payload.name.trim(), description: payload.description?.trim() || null, category: payload.category?.trim() || 'Dairy', unit: payload.unit.trim(), tax: payload.tax?.trim() || 'Exempt', lowStockThreshold: Number(payload.lowStockThreshold) || 0, isLocked: Boolean(payload.isLocked) } });
        await SyncQueueService.enqueueCreate(tx, 'InventoryProduct', created.id, created, 0);
        return created;
      });
      return { success: true, statusCode: 201, data: await this.productView(product, [], rate) };
    } catch (error: any) {
      if (error.code === 'P2002') return { success: false, statusCode: 409, message: 'Product code already exists.' };
      throw error;
    }
  }

  static async pricing(name: string) {
    const rate = await this.currentRate();
    return { sellingPrice: rateFor(name, rate), averageCost: await averageSupplierCost(name) };
  }

  static async updateProduct(id: number, payload: any) {
    const existing = await prisma.inventoryProduct.findUnique({ where: { id } });
    if (!existing) return { success: false, statusCode: 404, message: 'Product not found.' };
    const product = await prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryProduct.update({ where: { id }, data: { ...(payload.name !== undefined ? { name: String(payload.name).trim() } : {}), ...(payload.description !== undefined ? { description: payload.description?.trim() || null } : {}), ...(payload.unit !== undefined ? { unit: String(payload.unit).trim() } : {}), ...(payload.tax !== undefined ? { tax: String(payload.tax).trim() } : {}), ...(payload.category !== undefined ? { category: String(payload.category).trim() } : {}), ...(payload.lowStockThreshold !== undefined ? { lowStockThreshold: Number(payload.lowStockThreshold) } : {}), ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}) } });
      await SyncQueueService.enqueueUpdate(tx, 'InventoryProduct', updated.id, updated, 0);
      return updated;
    });
    return { success: true, statusCode: 200, data: await this.productView(product, await prisma.inventoryMovement.findMany({ where: { productId: id }, select: { quantity: true, unitCost: true } }), await this.currentRate()) };
  }

  static async deleteProduct(id: number) {
    const product = await prisma.inventoryProduct.findUnique({ where: { id } });
    if (!product) return { success: false, statusCode: 404, message: 'Product not found.' };
    // Core shop items (and all inventory rows) must stay — stock is adjusted, not deleted
    if (product.isLocked) {
      return { success: false, statusCode: 403, message: 'This product is locked and cannot be deleted.' };
    }
    return { success: false, statusCode: 403, message: 'Inventory products cannot be deleted. Adjust stock instead.' };
  }

  static async movements(productId?: number) {
    const movements = await prisma.inventoryMovement.findMany({ where: productId ? { productId } : undefined, orderBy: [{ productId: 'asc' }, { date: 'asc' }, { id: 'asc' }], include: { product: true, supplier: true } });
    const running = new Map<number, number>();
    const withBalances = movements.map((movement) => {
      const previousStock = money(running.get(movement.productId) || 0);
      const newStock = money(previousStock + movement.quantity);
      running.set(movement.productId, newStock);
      return { ...movement, previousStock, newStock };
    });
    return withBalances.sort((a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id);
  }

  static async stockIn(productId?: number) {
    return prisma.inventoryMovement.findMany({ where: { movementType: 'STOCK_IN', ...(productId ? { productId } : {}) }, orderBy: { date: 'desc' }, include: { product: true, supplier: true } });
  }

  static async record(userId: number, payload: any) {
    const productId = Number(payload.productId), quantity = Number(payload.quantity);
    if (!productId || !Number.isFinite(quantity) || quantity === 0 || !MOVEMENT_TYPES.includes(payload.movementType)) {
      return { success: false, statusCode: 400, message: 'Valid product, non-zero quantity, and movement type are required.' };
    }
    const product = await prisma.inventoryProduct.findUnique({ where: { id: productId } });
    if (!product) return { success: false, statusCode: 404, message: 'Product not found.' };
    const existing = await prisma.inventoryMovement.findUnique({ where: { reference: String(payload.reference || '') } });
    if (existing) return { success: true, statusCode: 200, data: existing };
    const current = (await prisma.inventoryMovement.aggregate({ where: { productId }, _sum: { quantity: true } }))._sum.quantity || 0;
    if (current + quantity < 0) return { success: false, statusCode: 422, message: 'Stock cannot become negative.' };

    const movementDate = payload.date ? new Date(payload.date) : new Date();
    const reference = String(payload.reference || `inventory-${Date.now()}`);
    const movementType = payload.movementType as string;
    const lostQty = quantity < 0 ? money(Math.abs(quantity)) : 0;
    const expenseCategory =
      lostQty > 0 && (movementType === 'ADJUSTMENT' || movementType === 'WASTAGE')
        ? milkOrYogurtExpenseCategory(product.name)
        : null;

    let unitCostForLoss = 0;
    if (expenseCategory) {
      unitCostForLoss = await averageSupplierCost(product.name);
      if (unitCostForLoss <= 0) {
        const rate = await this.currentRate();
        unitCostForLoss = money((rateFor(product.name, rate) || 0) * 0.65);
      }
    }

    const user =
      expenseCategory && userId
        ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } })
        : null;
    const addedBy = user?.email || user?.name || 'inventory';

    try {
      const movement = await prisma.$transaction(async (tx) => {
        const created = await tx.inventoryMovement.create({
          data: {
            productId,
            quantity: money(quantity),
            movementType,
            source: payload.source || movementType,
            reference,
            unitCost: payload.unitCost !== undefined ? Number(payload.unitCost) : null,
            supplierId: payload.supplierId ? Number(payload.supplierId) : null,
            shiftId: payload.shiftId ? Number(payload.shiftId) : null,
            userId,
            date: movementDate,
          },
        });

        // Milk / Yogurt stock removed = wastage loss → appear on Expenses screen
        if (expenseCategory && lostQty > 0) {
          const grossLoss = money(lostQty * unitCostForLoss);
          const reasonText =
            (typeof payload.notes === 'string' && payload.notes.trim()) ||
            (typeof payload.reason === 'string' && payload.reason.trim()) ||
            'Stock adjustment (lost / discarded)';

          const expense = await tx.expense.create({
            data: {
              date: toDateOnly(movementDate),
              category: expenseCategory,
              description: `${expenseCategory} stock loss — ${lostQty} kg removed from inventory`,
              quantity: lostQty,
              unitCost: unitCostForLoss,
              grossLoss,
              soldRecovery: 0,
              netExpense: grossLoss,
              amount: grossLoss,
              paidAmount: 0,
              remaining: grossLoss,
              reason: reasonText,
              addedBy,
            },
          });
          await SyncQueueService.enqueueCreate(tx, 'Expense', expense.id, expense, 1);
        }

        // Yogurt is made from milk — adding yogurt stock consumes milk 1:1
        // (milk may go negative if inventory milk is 0 / short)
        if (
          isYogurtProduct(product) &&
          quantity > 0 &&
          (movementType === 'ADJUSTMENT' || movementType === 'STOCK_IN')
        ) {
          await deductMilkConversion(tx, {
            milkKg: money(quantity * MILK_PER_KG_YOGURT),
            reference: `${reference}-milk`,
            source: 'Yogurt production (from milk)',
            userId,
            shiftId: payload.shiftId ? Number(payload.shiftId) : null,
            requireStock: false,
          });
        }

        await SyncQueueService.enqueueCreate(tx, 'InventoryMovement', created.id, created, 2);
        return created;
      });

      return { success: true, statusCode: 201, data: movement };
    } catch (err: any) {
      const msg = err?.message || 'Failed to record inventory movement.';
      if (/not enough milk|milk inventory product not found/i.test(msg)) {
        return { success: false, statusCode: 422, message: msg };
      }
      throw err;
    }
  }
}