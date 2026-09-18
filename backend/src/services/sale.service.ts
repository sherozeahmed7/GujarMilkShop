import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
import { NotificationService } from './notification.service';

const SALE_TYPES = ['walk_in', 'split', 'ledger_daily', 'ledger_monthly'] as const;
const LEDGER_TYPES = ['ledger_daily', 'ledger_monthly'] as const;
const ITEM_NAMES = ['milk', 'yogurt', 'lassi', 'butter', 'ghee'] as const;
const F2_ITEMS = ['lassi', 'butter', 'ghee'] as const;
const PAYMENT_METHODS = ['cash', 'online'] as const;

type SaleType = (typeof SALE_TYPES)[number];
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface SaleItemInput {
  itemName: string;
  quantity: number;
  unitPrice: number;
}

export interface CreateSalePayload {
  saleType: string;
  items: SaleItemInput[];
  totalAmount: number;
  paidAmount?: number;
  paymentMethod?: string;
  customerId?: number;
  customerName?: string;
  customerPhone?: string;
}

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseRangeStart(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(value);
}

function parseRangeEnd(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  return new Date(value);
}

function resolveDateRange(filters: {
  fromDate?: string;
  toDate?: string;
  dateFrom?: string;
  dateTo?: string;
}): { start?: Date; end?: Date } {
  const fromRaw = filters.fromDate || filters.dateFrom;
  const toRaw = filters.toDate || filters.dateTo;
  return {
    start: fromRaw ? parseRangeStart(fromRaw) : undefined,
    end: toRaw ? parseRangeEnd(toRaw) : undefined
  };
}

function paymentCategory(sale: {
  saleType: string;
  payments?: { method: string }[];
}): 'Cash' | 'Online' | 'Split' | 'Khata' {
  if (sale.saleType === 'walk_in') {
    const method = sale.payments?.[0]?.method;
    return method === 'online' ? 'Online' : 'Cash';
  }
  if (sale.saleType === 'split') return 'Split';
  if (sale.saleType === 'ledger_daily' || sale.saleType === 'ledger_monthly') return 'Khata';
  return 'Cash';
}

function localDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

async function getInventoryStockByCode(db: any, code: string): Promise<number> {
  const product = await db.inventoryProduct.findFirst({
    where: { code: code.toUpperCase() },
  });
  if (!product) {
    const all = await db.inventoryProduct.findMany({ where: { isActive: true } });
    const match = all.find((p: any) => String(p.name).toLowerCase() === code.toLowerCase());
    if (!match) return 0;
    const sum = await db.inventoryMovement.aggregate({
      where: { productId: match.id },
      _sum: { quantity: true },
    });
    return money(sum._sum.quantity || 0);
  }
  const sum = await db.inventoryMovement.aggregate({
    where: { productId: product.id },
    _sum: { quantity: true },
  });
  return money(sum._sum.quantity || 0);
}

/** Butter & Ghee may only be sold from inventory stock (not F2-only / negative). */
async function assertButterGheeInventoryStock(
  items: { itemName: string; quantity: number }[]
): Promise<{ ok: true } | { ok: false; statusCode: number; message: string }> {
  const needed = new Map<string, number>();
  for (const item of items) {
    const key = item.itemName.toLowerCase();
    if (key !== 'butter' && key !== 'ghee') continue;
    needed.set(key, money((needed.get(key) || 0) + item.quantity));
  }
  if (needed.size === 0) return { ok: true };

  for (const [name, qty] of needed) {
    const available = await getInventoryStockByCode(prisma, name);
    if (available < qty) {
      const label = name === 'butter' ? 'Butter' : 'Ghee';
      if (available <= 0) {
        return {
          ok: false,
          statusCode: 422,
          message: `Cannot sell ${label}. Inventory stock is 0 kg. Add ${label} stock in Inventory first.`,
        };
      }
      return {
        ok: false,
        statusCode: 422,
        message: `Cannot sell ${qty} kg ${label}. Only ${available} kg available in Inventory. Add more stock or reduce quantity.`,
      };
    }
  }
  return { ok: true };
}

async function recordInventorySale(tx: any, saleId: number, items: SaleItemInput[], userId?: number) {
  const shift = await tx.shift.findFirst({ where: { status: 'Open' }, orderBy: { openedAt: 'asc' } });

  // Merge same itemName into one stock movement
  const byName = new Map<string, number>();
  for (const item of items) {
    const key = item.itemName.toLowerCase();
    byName.set(key, money((byName.get(key) || 0) + item.quantity));
  }

  for (const [itemName, quantity] of byName) {
    let product = await tx.inventoryProduct.findFirst({
      where: { code: itemName.toUpperCase() },
    });
    if (!product) {
      const all = await tx.inventoryProduct.findMany({ where: { isActive: true } });
      product = all.find((p: any) => String(p.name).toLowerCase() === itemName) || null;
    }

    if (product) {
      const reference = `sale-${saleId}-${itemName}`;
      const existing = await tx.inventoryMovement.findUnique({ where: { reference } });
      if (!existing) {
        // Allow sale at zero / negative stock — balance just goes further down
        const movement = await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            quantity: money(-quantity),
            movementType: 'SALE',
            source: 'Point of Sale',
            reference,
            userId,
            shiftId: shift?.id,
          },
        });

        await SyncQueueService.enqueueCreate(tx, 'InventoryMovement', movement.id, movement, 2);
      }
    }
    // Lassi sales only move LASSI inventory (may go negative).
    // Milk was already taken when adding milk in F2 — do not deduct milk again on sale.
  }
}

function buildTrendBuckets(
  start: Date,
  end: Date
): { key: string; label: string; value: number }[] {
  const spanMs = end.getTime() - start.getTime();
  const spanDays = Math.max(1, Math.ceil(spanMs / 86400000));

  if (spanDays <= 2) {
    const buckets: { key: string; label: string; value: number }[] = [];
    const cursor = new Date(start);
    cursor.setMinutes(0, 0, 0);
    while (cursor <= end) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}-${cursor.getHours()}`;
      buckets.push({
        key,
        label: cursor.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        value: 0
      });
      cursor.setHours(cursor.getHours() + 1);
    }
    return buckets;
  }

  if (spanDays <= 62) {
    const buckets: { key: string; label: string; value: number }[] = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    while (cursor <= endDay) {
      const key = localDateKey(cursor);
      buckets.push({
        key,
        label: cursor.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit' }),
        value: 0
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return buckets;
  }

  const buckets: { key: string; label: string; value: number }[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endMonth = new Date(end.getFullYear(), end.getMonth(), 1);
  while (cursor <= endMonth) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
    buckets.push({
      key,
      label: cursor.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      value: 0
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return buckets;
}

function trendBucketKey(date: Date, start: Date, end: Date): string {
  const spanDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));

  if (spanDays <= 2) {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  }

  if (spanDays <= 62) {
    return localDateKey(date);
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildSalesAnalytics(
  sales: Array<{
    saleType: string;
    totalAmount: number;
    paidAmount: number;
    createdAt: Date;
    items?: { itemName: string; totalPrice: number }[];
    payments?: { method: string }[];
  }>,
  rangeStart?: Date,
  rangeEnd?: Date
) {
  const netSales = money(sales.reduce((sum, s) => sum + s.totalAmount, 0));

  const cashSales = money(
    sales
      .filter((s) => s.saleType === 'walk_in' && s.payments?.[0]?.method === 'cash')
      .reduce((sum, s) => sum + s.totalAmount, 0)
  );

  const onlineSales = money(
    sales
      .filter((s) => s.saleType === 'walk_in' && s.payments?.[0]?.method === 'online')
      .reduce((sum, s) => sum + s.totalAmount, 0)
  );

  const splitSales = money(
    sales.filter((s) => s.saleType === 'split').reduce((sum, s) => sum + s.totalAmount, 0)
  );

  const summary = {
    netSales,
    cashSales,
    onlineSales,
    splitSales,
    totalBills: sales.length
  };

  const start = rangeStart || (sales.length
    ? new Date(Math.min(...sales.map((s) => new Date(s.createdAt).getTime())))
    : new Date());
  const end = rangeEnd || (sales.length
    ? new Date(Math.max(...sales.map((s) => new Date(s.createdAt).getTime())))
    : new Date());

  const trendBuckets = buildTrendBuckets(start, end);
  const trendMap = new Map(trendBuckets.map((b) => [b.key, 0]));

  for (const sale of sales) {
    const key = trendBucketKey(new Date(sale.createdAt), start, end);
    if (trendMap.has(key)) {
      trendMap.set(key, money((trendMap.get(key) || 0) + sale.totalAmount));
    }
  }

  const trend = trendBuckets.map((b) => ({
    label: b.label,
    value: trendMap.get(b.key) || 0
  }));

  const paymentAmounts: Record<string, number> = {
    Cash: 0,
    Online: 0,
    Split: 0,
    Khata: 0
  };

  for (const sale of sales) {
    const category = paymentCategory(sale);
    paymentAmounts[category] = money(paymentAmounts[category] + sale.totalAmount);
  }

  const paymentMethods = Object.entries(paymentAmounts)
    .filter(([, amount]) => amount > 0)
    .map(([name, amount]) => ({
      name,
      amount,
      value: netSales > 0 ? Math.round((amount / netSales) * 100) : 0
    }));

  const categoryAmounts: Record<string, number> = { milk: 0, yogurt: 0, lassi: 0, butter: 0, ghee: 0 };

  for (const sale of sales) {
    for (const item of sale.items || []) {
      const key = item.itemName in categoryAmounts ? item.itemName : 'milk';
      categoryAmounts[key] = money(categoryAmounts[key] + item.totalPrice);
    }
  }

  const categoryTotal = money(
    Object.values(categoryAmounts).reduce((s, v) => s + v, 0)
  );

  const CATEGORY_LABELS: Record<string, string> = {
    milk: 'Milk', yogurt: 'Yogurt', lassi: 'Lassi', butter: 'Butter', ghee: 'Ghee'
  };

  const categoryBreakdown = Object.entries(categoryAmounts)
    .filter(([, amount]) => amount > 0)
    .map(([key, amount]) => ({
      label: CATEGORY_LABELS[key] || key,
      amount,
      value: categoryTotal > 0 ? Math.round((amount / categoryTotal) * 100) : 0
    }));

  return { summary, trend, paymentMethods, categoryBreakdown };
}

function isLedgerType(saleType: string): boolean {
  return (LEDGER_TYPES as readonly string[]).includes(saleType);
}

/**
 * Called inside a Prisma transaction after a sale is created.
 * If the sale contains F2 items (lassi, butter, ghee), deducts sold
 * quantities from today's MilkProductDailyStock record.
 */
async function deductF2Stock(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  payload: CreateSalePayload
): Promise<void> {
  const f2Items = payload.items.filter((i) => (F2_ITEMS as readonly string[]).includes(i.itemName));
  if (f2Items.length === 0) return;

  const today = new Date();
  const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);

  let stock = await tx.milkProductDailyStock.findFirst({
    where: { date: { gte: dayStart, lte: dayEnd } }
  });

  // Create today's F2 row if missing so sale can still deduct (including from 0)
  if (!stock) {
    stock = await tx.milkProductDailyStock.create({
      data: { date: dayStart },
    });
    await SyncQueueService.createCloudMapping('MilkProductDailyStock', stock.id, undefined, tx);
  }

  let lassiSoldDelta = 0;
  let butterSoldDelta = 0;
  let gheeSoldDelta = 0;

  for (const item of f2Items) {
    if (item.itemName === 'lassi') lassiSoldDelta = money(lassiSoldDelta + item.quantity);
    if (item.itemName === 'butter') butterSoldDelta = money(butterSoldDelta + item.quantity);
    if (item.itemName === 'ghee') gheeSoldDelta = money(gheeSoldDelta + item.quantity);
  }

  const updatedStock = await tx.milkProductDailyStock.update({
    where: { id: stock.id },
    data: {
      lassiSold: money(stock.lassiSold + lassiSoldDelta),
      // Can go below zero when selling with no / low stock
      lassiRemaining: money(stock.lassiRemaining - lassiSoldDelta),
      butterSold: money(stock.butterSold + butterSoldDelta),
      butterClosing: money(stock.butterClosing - butterSoldDelta),
      gheeSold: money(stock.gheeSold + gheeSoldDelta),
      gheeClosing: money(stock.gheeClosing - gheeSoldDelta),
    }
  });

  await SyncQueueService.enqueueUpdate(tx, 'MilkProductDailyStock', updatedStock.id, updatedStock, 2, 'UPSERT');
}

async function getNextTokenNumber(tx: any): Promise<number> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const lastSale = await tx.sale.findFirst({
    where: { createdAt: { gte: startOfMonth } },
    orderBy: { tokenNumber: 'desc' }
  });

  return lastSale ? (lastSale.tokenNumber || 0) + 1 : 1;
}

export class SaleService {
  /**
   * Creates a sale (walk_in | split | ledger_daily | ledger_monthly)
   * with full edge-case validation.
   */
  static async createSale(payload: CreateSalePayload, userId?: number) {
    const {
      saleType,
      items,
      totalAmount,
      paidAmount,
      paymentMethod,
      customerId,
      customerName,
      customerPhone
    } = payload;

    // --- Basic validation ---
    if (!saleType || !(SALE_TYPES as readonly string[]).includes(saleType)) {
      return {
        success: false,
        statusCode: 400,
        message: `Invalid saleType. Allowed: ${SALE_TYPES.join(', ')}`
      };
    }

    if (!Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        statusCode: 400,
        message: 'items array is required and must contain at least one item.'
      };
    }

    if (totalAmount === undefined || totalAmount === null || Number.isNaN(Number(totalAmount))) {
      return {
        success: false,
        statusCode: 400,
        message: 'totalAmount is required.'
      };
    }

    const total = money(Number(totalAmount));
    if (total <= 0) {
      return {
        success: false,
        statusCode: 400,
        message: 'totalAmount must be greater than 0.'
      };
    }

    // Validate items
    const normalizedItems: { itemName: string; quantity: number; unitPrice: number; totalPrice: number }[] = [];
    let itemsSum = 0;

    for (const item of items) {
      if (!item.itemName || !(ITEM_NAMES as readonly string[]).includes(item.itemName)) {
        return {
          success: false,
          statusCode: 400,
          message: `Invalid itemName "${item.itemName}". Allowed: ${ITEM_NAMES.join(', ')}`
        };
      }
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      if (!quantity || quantity <= 0 || Number.isNaN(quantity)) {
        return {
          success: false,
          statusCode: 400,
          message: 'Each item must have a quantity greater than 0.'
        };
      }
      if (unitPrice === undefined || Number.isNaN(unitPrice) || unitPrice < 0) {
        return {
          success: false,
          statusCode: 400,
          message: 'Each item must have a valid unitPrice (>= 0).'
        };
      }
      const totalPrice = money(quantity * unitPrice);
      itemsSum = money(itemsSum + totalPrice);
      normalizedItems.push({
        itemName: item.itemName,
        quantity,
        unitPrice,
        totalPrice
      });
    }

    if (itemsSum !== total) {
      return {
        success: false,
        statusCode: 400,
        message: `totalAmount (${total}) must equal sum of item totals (${itemsSum}).`
      };
    }

    // ========== BUTTER / GHEE INVENTORY STOCK ==========
    // Must have enough inventory stock before sale (cannot sell into negative).
    const stockCheck = await assertButterGheeInventoryStock(normalizedItems);
    if (!stockCheck.ok) {
      return {
        success: false,
        statusCode: stockCheck.statusCode,
        message: stockCheck.message,
      };
    }

    // ========== F2 STOCK ==========
    // Lassi may sell at zero / negative F2 remaining.
    // Butter/Ghee F2 counters still update, but inventory gate above blocks oversell.

    // ========== WALK-IN ==========
    if (saleType === 'walk_in') {
      const paid = money(Number(paidAmount));

      if (paidAmount === undefined || paidAmount === null || Number.isNaN(paid)) {
        return {
          success: false,
          statusCode: 400,
          message: 'paidAmount is required for walk_in sales.'
        };
      }

      // Edge: overpayment
      if (paid > total) {
        return {
          success: false,
          statusCode: 400,
          message: 'Overpayment not allowed. paidAmount cannot exceed totalAmount.'
        };
      }

      // Edge: walk-in must pay full amount
      if (paid !== total) {
        return {
          success: false,
          statusCode: 400,
          message: 'Walk-in sales require paidAmount to equal totalAmount. Partial payment is not allowed.'
        };
      }

      if (!paymentMethod || !(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
        return {
          success: false,
          statusCode: 400,
          message: `paymentMethod is required for walk_in. Allowed: ${PAYMENT_METHODS.join(', ')}`
        };
      }

      const sale = await prisma.$transaction(async (tx) => {
        const tokenNumber = await getNextTokenNumber(tx);
        const created = await tx.sale.create({
          data: {
            saleType,
            customerId: null,
            customerName: customerName?.trim() || null,
            customerPhone: customerPhone?.trim() || null,
            totalAmount: total,
            paidAmount: paid,
            remainingBalance: 0,
            status: 'paid',
            tokenNumber,
            items: { create: normalizedItems },
            payments: {
              create: { method: paymentMethod as PaymentMethod, amount: paid, status: 'completed' }
            }
          },
          include: { items: true, payments: true }
        });
        await deductF2Stock(tx, payload);
        await recordInventorySale(tx, created.id, normalizedItems, userId);
        
        await SyncQueueService.enqueueCreate(tx, 'Sale', created.id, created, 1);
        for (const item of created.items) {
          await SyncQueueService.enqueueCreate(tx, 'SaleItem', item.id, item, 2);
        }
        for (const payment of created.payments) {
          await SyncQueueService.enqueueCreate(tx, 'Payment', payment.id, payment, 2);
        }
        
        return created;
      });

      NotificationService.create({
        category: 'sale',
        title: 'Walk-in Sale Completed',
        message: `Sale of Rs. ${total.toLocaleString()} completed — Bill #${sale.id} (Token #${sale.tokenNumber || sale.id}).`,
        metadata: { saleId: sale.id, saleType: 'walk_in', totalAmount: total },
      }).catch(() => {});

      return { success: true, statusCode: 201, message: 'Walk-in sale created successfully.', data: sale };
    }

    // ========== SPLIT ==========
    if (saleType === 'split') {
      const paid = money(Number(paidAmount));

      if (paidAmount === undefined || paidAmount === null || Number.isNaN(paid)) {
        return {
          success: false,
          statusCode: 400,
          message: 'paidAmount is required for split sales.'
        };
      }

      // Edge: overpayment
      if (paid > total) {
        return {
          success: false,
          statusCode: 400,
          message: 'Overpayment not allowed. paidAmount cannot exceed totalAmount.'
        };
      }

      // Edge: paidAmount must be > 0 for split
      if (paid <= 0) {
        return {
          success: false,
          statusCode: 400,
          message: 'Split sales require paidAmount greater than 0 (must pay something upfront).'
        };
      }

      // Edge: paidAmount must be < totalAmount (equal = walk-in)
      if (paid === total) {
        return {
          success: false,
          statusCode: 400,
          message: 'Split sales require paidAmount less than totalAmount. Use walk_in for full payment.'
        };
      }

      if (!paymentMethod || !(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
        return {
          success: false,
          statusCode: 400,
          message: `paymentMethod is required for split. Allowed: ${PAYMENT_METHODS.join(', ')}`
        };
      }

      const remaining = money(total - paid);

      const sale = await prisma.$transaction(async (tx) => {
        const tokenNumber = await getNextTokenNumber(tx);
        const created = await tx.sale.create({
          data: {
            saleType,
            customerId: null,
            customerName: customerName?.trim() || null,
            customerPhone: customerPhone?.trim() || null,
            totalAmount: total,
            paidAmount: paid,
            remainingBalance: remaining,
            status: 'partial',
            tokenNumber,
            items: { create: normalizedItems },
            payments: {
              create: { method: paymentMethod as PaymentMethod, amount: paid, status: 'partial' }
            }
          },
          include: { items: true, payments: true }
        });
        await deductF2Stock(tx, payload);
        await recordInventorySale(tx, created.id, normalizedItems, userId);
        
        await SyncQueueService.enqueueCreate(tx, 'Sale', created.id, created, 1);
        for (const item of created.items) {
          await SyncQueueService.enqueueCreate(tx, 'SaleItem', item.id, item, 2);
        }
        for (const payment of created.payments) {
          await SyncQueueService.enqueueCreate(tx, 'Payment', payment.id, payment, 2);
        }
        
        return created;
      });

      NotificationService.create({
        category: 'sale',
        title: 'Split Sale Created',
        message: `Split sale of Rs. ${total.toLocaleString()} created (Paid: Rs. ${paid.toLocaleString()}, Remaining: Rs. ${remaining.toLocaleString()}) — Bill #${sale.id}.`,
        metadata: { saleId: sale.id, saleType: 'split', totalAmount: total, paidAmount: paid, remainingBalance: remaining },
      }).catch(() => {});

      return { success: true, statusCode: 201, message: 'Split sale created successfully.', data: sale };
    }

    // ========== LEDGER (daily / monthly) ==========
    if (isLedgerType(saleType)) {
      if (!customerId) {
        return {
          success: false,
          statusCode: 400,
          message: 'customerId is required for ledger sales.'
        };
      }

      const customer = await prisma.customer.findUnique({
        where: { id: Number(customerId) }
      });

      if (!customer) {
        return {
          success: false,
          statusCode: 404,
          message: 'Customer not found.'
        };
      }

      if (customer.status !== 'active') {
        return {
          success: false,
          statusCode: 400,
          message: 'Cannot create sale for an inactive customer.'
        };
      }

      // Expected type alignment (soft check)
      const expectedType =
        saleType === 'ledger_daily' ? 'daily_ledger' : 'monthly_ledger';
      if (customer.customerType !== expectedType) {
        return {
          success: false,
          statusCode: 400,
          message: `Customer type mismatch. This customer is "${customer.customerType}" but saleType is "${saleType}".`
        };
      }

      // Ledger: paidAmount forced to 0; no payment method needed yet
      const sale = await prisma.$transaction(async (tx) => {
        const tokenNumber = await getNextTokenNumber(tx);
        const created = await tx.sale.create({
          data: {
            saleType: saleType as SaleType,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone || null,
            totalAmount: total,
            paidAmount: 0,
            remainingBalance: total,
            status: 'pending',
            tokenNumber,
            items: { create: normalizedItems },
            payments: {
              create: { method: 'cash', amount: 0, status: 'pending' }
            }
          },
          include: { items: true, payments: true, customer: true }
        });
        await deductF2Stock(tx, payload);
        await recordInventorySale(tx, created.id, normalizedItems, userId);
        
        await SyncQueueService.enqueueCreate(tx, 'Sale', created.id, created, 1);
        for (const item of created.items) {
          await SyncQueueService.enqueueCreate(tx, 'SaleItem', item.id, item, 2);
        }
        for (const payment of created.payments) {
          await SyncQueueService.enqueueCreate(tx, 'Payment', payment.id, payment, 2);
        }
        
        return created;
      });

      NotificationService.create({
        category: 'sale',
        title: 'Khata Sale Recorded',
        message: `Ledger sale of Rs. ${total.toLocaleString()} recorded for ${customer.name} — Bill #${sale.id}.`,
        metadata: { saleId: sale.id, customerId: customer.id, customerName: customer.name, totalAmount: total },
      }).catch(() => {});

      return { success: true, statusCode: 201, message: 'Ledger sale created successfully.', data: sale };
    }

    return {
      success: false,
      statusCode: 400,
      message: 'Unsupported saleType.'
    };
  }

  /**
   * Lists sales with optional filters: saleType, status, customerId, phone,
   * fromDate/toDate (ISO) or dateFrom/dateTo (YYYY-MM-DD).
   * When includeAnalytics is true, returns sales plus report aggregates.
   */
  static async listSales(
    filters: {
      saleType?: string;
      status?: string;
      customerId?: number;
      phone?: string;
      fromDate?: string;
      toDate?: string;
      dateFrom?: string;
      dateTo?: string;
    },
    includeAnalytics = false
  ) {
    const where: any = {};

    if (filters.saleType) where.saleType = filters.saleType;
    if (filters.status) where.status = filters.status;
    if (filters.customerId) where.customerId = Number(filters.customerId);
    if (filters.phone?.trim()) {
      where.customerPhone = { contains: filters.phone.trim() };
    }

    const { start, end } = resolveDateRange(filters);
    if (start || end) {
      where.createdAt = {};
      if (start) where.createdAt.gte = start;
      if (end) where.createdAt.lte = end;
    }

    const sales = await prisma.sale.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        items: true,
        payments: true,
        customer: true
      }
    });

    if (!includeAnalytics) {
      return {
        success: true,
        statusCode: 200,
        data: sales.map((s) => ({
          ...s,
          // Ledger sales store name on Customer relation, not customerName column
          customerName: s.customerName || s.customer?.name || null,
          customerPhone: s.customerPhone || s.customer?.phone || null,
        })),
      };
    }

    const analytics = buildSalesAnalytics(sales, start, end);
    const shaped = sales.map((s) => ({
      ...s,
      customerName: s.customerName || s.customer?.name || null,
      customerPhone: s.customerPhone || s.customer?.phone || null,
    }));

    return {
      success: true,
      statusCode: 200,
      data: {
        sales: shaped,
        analytics
      }
    };
  }

  /**
   * Get a single sale with items + payments
   */
  static async getSaleById(id: number) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
        customer: true
      }
    });

    if (!sale) {
      return {
        success: false,
        statusCode: 404,
        message: 'Sale not found.'
      };
    }

    return {
      success: true,
      statusCode: 200,
      data: {
        ...sale,
        customerName: sale.customerName || sale.customer?.name || null,
        customerPhone: sale.customerPhone || sale.customer?.phone || null,
      }
    };
  }

  /**
   * Settle a specific SPLIT sale's remaining due.
   * Edge cases:
   * - Already paid → reject
   * - Not split / not partial → reject
   * - Double settlement protection
   */
  static async settleSplitSale(saleId: number, paymentMethod: string, amount?: number) {
    if (!paymentMethod || !(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
      return {
        success: false,
        statusCode: 400,
        message: `paymentMethod is required. Allowed: ${PAYMENT_METHODS.join(', ')}`
      };
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { payments: true, items: true }
    });

    if (!sale) {
      return {
        success: false,
        statusCode: 404,
        message: 'Sale not found.'
      };
    }

    // Edge: double settlement protection
    if (sale.status === 'paid') {
      return {
        success: false,
        statusCode: 400,
        message: 'This sale has already been settled.'
      };
    }

    if (sale.saleType !== 'split') {
      return {
        success: false,
        statusCode: 400,
        message: 'Only split sales can be settled via this endpoint. Use customer settle-all for ledger dues.'
      };
    }

    if (sale.status !== 'partial' || sale.remainingBalance <= 0) {
      return {
        success: false,
        statusCode: 400,
        message: 'This sale has no remaining balance to settle.'
      };
    }

    const remaining = money(sale.remainingBalance);
    const settleAmount = amount === undefined || amount === null ? remaining : money(Number(amount));

    if (Number.isNaN(settleAmount)) {
      return {
        success: false,
        statusCode: 400,
        message: 'Amount must be a valid number.'
      };
    }

    if (settleAmount <= 0) {
      return {
        success: false,
        statusCode: 400,
        message: 'Settlement amount must be greater than zero.'
      };
    }

    if (settleAmount > remaining) {
      return {
        success: false,
        statusCode: 400,
        message: `Amount cannot exceed the remaining balance of Rs. ${remaining}.`
      };
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Find affected payments first
      const partialPayments = await tx.payment.findMany({
        where: { saleId: sale.id, status: 'partial' }
      });

      for (const p of partialPayments) {
        const updatedP = await tx.payment.update({
          where: { id: p.id },
          data: { status: 'completed' }
        });
        await SyncQueueService.enqueueUpdate(tx, 'Payment', updatedP.id, updatedP, 2);
      }

      const newPay = await tx.payment.create({
        data: {
          saleId: sale.id,
          method: paymentMethod as PaymentMethod,
          amount: settleAmount,
          status: 'completed'
        }
      });
      await SyncQueueService.enqueueCreate(tx, 'Payment', newPay.id, newPay, 2);

      const newRemaining = money(remaining - settleAmount);
      const newPaidAmount = money(sale.paidAmount + settleAmount);

      const updatedSale = await tx.sale.update({
        where: { id: sale.id },
        data: {
          paidAmount: newPaidAmount,
          remainingBalance: newRemaining,
          status: newRemaining <= 0 ? 'paid' : 'partial'
        },
        include: { items: true, payments: true }
      });
      await SyncQueueService.enqueueUpdate(tx, 'Sale', updatedSale.id, updatedSale, 1);

      return updatedSale;
    });

    NotificationService.create({
      category: 'sale',
      title: 'Split Balance Settled',
      message: `Payment of Rs. ${settleAmount.toLocaleString()} received for Bill #${sale.id} via ${paymentMethod}.`,
      metadata: { saleId: sale.id, amount: settleAmount, paymentMethod },
    }).catch(() => {});

    return {
      success: true,
      statusCode: 200,
      message: settleAmount === remaining
        ? 'Split sale settled successfully.'
        : `Partial payment of Rs. ${settleAmount} recorded successfully.`,
      data: updated
    };
  }
}
