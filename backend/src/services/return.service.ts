import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
import { NotificationService } from './notification.service';
const F2_ITEMS = ['lassi', 'butter', 'ghee'] as const;

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatReturn(r: any) {
  return {
    ...r,
    returnId: String(r.id),
    id: String(r.id),
    items: (r.items || []).map((i: any) => ({ ...i, id: String(i.id) })),
  };
}

async function restoreInventory(
  tx: any,
  returnId: number,
  items: Array<{ name: string; returnQty: number }>,
  userId?: number
) {
  const shift = await tx.shift.findFirst({
    where: { status: 'Open' },
    orderBy: { openedAt: 'asc' },
  });

  const byName = new Map<string, number>();
  for (const item of items) {
    const key = String(item.name || '').toLowerCase().trim();
    if (!key || item.returnQty <= 0) continue;
    byName.set(key, money((byName.get(key) || 0) + item.returnQty));
  }

  for (const [itemName, quantity] of byName) {
    let product = await tx.inventoryProduct.findFirst({
      where: { code: itemName.toUpperCase() },
    });
    if (!product) {
      const all = await tx.inventoryProduct.findMany({ where: { isActive: true } });
      product =
        all.find((p: any) => String(p.name).toLowerCase() === itemName) || null;
    }
    if (!product) continue;

    const reference = `return-${returnId}-${itemName}`;
    const existing = await tx.inventoryMovement.findUnique({ where: { reference } });
    if (existing) continue;

    const movement = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        quantity: money(quantity), // positive = stock back in
        movementType: 'RETURN',
        source: 'Sales Return',
        reference,
        userId,
        shiftId: shift?.id,
      },
    });
    await SyncQueueService.enqueueCreate(tx, 'InventoryMovement', movement.id, movement, 2);
  }
}

async function restoreF2Stock(
  tx: any,
  items: Array<{ name: string; returnQty: number }>,
  returnDate?: string
) {
  const f2Items = items.filter((i) =>
    (F2_ITEMS as readonly string[]).includes(String(i.name || '').toLowerCase().trim())
  );
  if (f2Items.length === 0) return;

  const base = returnDate && /^\d{4}-\d{2}-\d{2}$/.test(returnDate)
    ? new Date(returnDate + 'T00:00:00')
    : new Date();
  const dayStart = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
  const dayEnd = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 23, 59, 59, 999);

  let stock = await tx.milkProductDailyStock.findFirst({
    where: { date: { gte: dayStart, lte: dayEnd } },
  });
  if (!stock) {
    stock = await tx.milkProductDailyStock.create({ data: { date: dayStart } });
    await SyncQueueService.createCloudMapping('MilkProductDailyStock', stock.id, undefined, tx);
  }

  let lassiDelta = 0;
  let butterDelta = 0;
  let gheeDelta = 0;
  for (const item of f2Items) {
    const name = String(item.name || '').toLowerCase().trim();
    const qty = money(Number(item.returnQty) || 0);
    if (name === 'lassi') lassiDelta = money(lassiDelta + qty);
    if (name === 'butter') butterDelta = money(butterDelta + qty);
    if (name === 'ghee') gheeDelta = money(gheeDelta + qty);
  }

  const updatedStock = await tx.milkProductDailyStock.update({
    where: { id: stock.id },
    data: {
      lassiSold: money(Math.max(0, stock.lassiSold - lassiDelta)),
      lassiRemaining: money(stock.lassiRemaining + lassiDelta),
      butterSold: money(Math.max(0, stock.butterSold - butterDelta)),
      butterClosing: money(stock.butterClosing + butterDelta),
      gheeSold: money(Math.max(0, stock.gheeSold - gheeDelta)),
      gheeClosing: money(stock.gheeClosing + gheeDelta),
    },
  });
  await SyncQueueService.enqueueUpdate(tx, 'MilkProductDailyStock', updatedStock.id, updatedStock, 2, 'UPSERT');
}

function saleStatus(totalAmount: number, paidAmount: number, remainingBalance: number): string {
  if (remainingBalance <= 0) return 'paid';
  if (paidAmount > 0) return 'partial';
  if (totalAmount <= 0) return 'paid';
  return 'pending';
}

export class ReturnService {
  static async list(filters?: {
    fromDate?: string;
    toDate?: string;
    customerId?: number;
    saleIds?: number[];
  }) {
    const where: any = {};
    if (filters?.fromDate || filters?.toDate) {
      where.date = {};
      if (filters.fromDate) where.date.gte = filters.fromDate;
      if (filters.toDate) where.date.lte = filters.toDate;
    }

    let saleIds = filters?.saleIds?.filter((id) => Number.isFinite(id)) || [];
    if (filters?.customerId) {
      const sales = await prisma.sale.findMany({
        where: { customerId: filters.customerId },
        select: { id: true },
      });
      saleIds = [...new Set([...saleIds, ...sales.map((s) => s.id)])];
      if (saleIds.length === 0) {
        return { success: true, statusCode: 200, data: [] };
      }
      where.saleId = { in: saleIds };
    } else if (saleIds.length > 0) {
      where.saleId = { in: saleIds };
    }

    const returns = await prisma.return.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      statusCode: 200,
      data: returns.map(formatReturn),
    };
  }

  static async create(
    payload: {
      billNumber: string;
      date: string;
      customer?: string;
      returnType: string;
      refundAmount: number;
      paymentMethod?: string;
      reason?: string;
      status?: string;
      items?: Array<{
        itemId?: string;
        name?: string;
        returnQty?: number;
        unitPrice?: number;
        refundAmount?: number;
      }>;
    },
    processedBy: string,
    userId?: number
  ) {
    const {
      billNumber,
      date,
      customer,
      returnType,
      refundAmount,
      paymentMethod,
      reason,
      status,
      items,
    } = payload;

    if (!billNumber || !date || !returnType || refundAmount === undefined) {
      return {
        success: false,
        statusCode: 400,
        message: 'billNumber, date, returnType, and refundAmount are required.',
      };
    }

    const saleId = parseInt(billNumber, 10);
    const sale =
      !isNaN(saleId)
        ? await prisma.sale.findUnique({
            where: { id: saleId },
            include: { items: true },
          })
        : null;

    const normalizedItems = (items || []).map((i) => ({
      itemId: String(i.itemId || ''),
      name: String(i.name || '').trim(),
      returnQty: money(Number(i.returnQty) || 0),
      unitPrice: money(Number(i.unitPrice) || 0),
      refundAmount: money(Number(i.refundAmount) || 0),
    }));

    const refund = money(Number(refundAmount));

    const result = await prisma.$transaction(async (tx) => {
      const ret = await tx.return.create({
        data: {
          saleId: sale ? sale.id : null,
          billNumber,
          date,
          customer: customer || 'Walk-in',
          returnType,
          refundAmount: refund,
          paymentMethod: paymentMethod || 'Cash',
          reason: reason || '',
          status: status || 'Completed',
          processedBy,
          items: {
            create: normalizedItems.map((i) => ({
              itemId: i.itemId,
              name: i.name,
              returnQty: i.returnQty,
              unitPrice: i.unitPrice,
              refundAmount: i.refundAmount,
            })),
          },
        },
        include: { items: true },
      });

      // Adjust original sale so khata remaining / totals stay correct
      if (sale) {
        const newTotal = money(Math.max(0, sale.totalAmount - refund));
        let newPaid = money(sale.paidAmount);
        let newRemaining = money(newTotal - newPaid);
        if (newRemaining < 0) {
          newPaid = newTotal;
          newRemaining = 0;
        }
        const updatedSale = await tx.sale.update({
          where: { id: sale.id },
          data: {
            totalAmount: newTotal,
            paidAmount: newPaid,
            remainingBalance: newRemaining,
            status: saleStatus(newTotal, newPaid, newRemaining),
          },
        });
        await SyncQueueService.enqueueUpdate(tx, 'Sale', updatedSale.id, updatedSale, 1);
      }

      // Put stock back (core inventory + F2)
      await restoreInventory(tx, ret.id, normalizedItems, userId);
      await restoreF2Stock(tx, normalizedItems, date);

      // Enqueue Return CREATE after items are created
      await SyncQueueService.enqueueCreate(tx, 'Return', ret.id, ret, 3);
      for (const item of ret.items) {
        await SyncQueueService.enqueueCreate(tx, 'ReturnItem', item.id, item, 3);
      }

      return ret;
    });

    // Safely dispatch notification
    NotificationService.create({
      category: 'return',
      title: 'Sale Return Processed',
      message: `Return of Rs. ${refundAmount.toLocaleString()} processed for Bill #${billNumber}${customer ? ` (${customer})` : ''}.`,
      actionUrl: '/returns',
      actionLabel: 'Review Return',
      metadata: { returnId: result.id, billNumber, refundAmount, customer },
    }).catch(() => {});

    return {
      success: true,
      statusCode: 201,
      message: 'Return created.',
      data: formatReturn(result),
    };
  }

  static async lookupBill(billNumber: string) {
    const saleId = parseInt(billNumber, 10);
    if (isNaN(saleId)) {
      return { success: false, statusCode: 400, message: 'Invalid bill number.' };
    }

    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true, customer: true },
    });
    if (!sale) {
      return { success: false, statusCode: 404, message: `Bill #${billNumber} not found.` };
    }

    // Already-returned qty per sale item name (sum of prior returns)
    const priorReturns = await prisma.return.findMany({
      where: { saleId: sale.id },
      include: { items: true },
    });
    const returnedByName = new Map<string, number>();
    for (const r of priorReturns) {
      for (const item of r.items) {
        const key = String(item.name || '').toLowerCase();
        returnedByName.set(key, money((returnedByName.get(key) || 0) + item.returnQty));
      }
    }

    const bill = {
      billNumber: String(sale.id),
      date: sale.createdAt.toISOString().split('T')[0],
      customer: sale.customer?.name || sale.customerName || 'Walk-in',
      customerId: sale.customerId,
      paymentMethod: sale.saleType === 'walk_in' ? 'Cash' : 'Khata',
      saleType: sale.saleType,
      total: sale.totalAmount,
      remainingBalance: sale.remainingBalance,
      cashier: 'System',
      items: (sale.items || []).map((i) => {
        const alreadyReturned = returnedByName.get(i.itemName.toLowerCase()) || 0;
        const maxReturnable = money(Math.max(0, i.quantity - alreadyReturned));
        return {
          id: String(i.id),
          name: i.itemName,
          category: i.itemName,
          quantity: i.quantity,
          returnableQty: maxReturnable,
          unitPrice: i.unitPrice,
          lineTotal: i.totalPrice,
        };
      }),
    };

    return { success: true, statusCode: 200, data: bill };
  }
}
