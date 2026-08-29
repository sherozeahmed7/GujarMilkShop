import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

function formatReturn(r: any) {
  return {
    ...r,
    returnId: String(r.id),
    id: String(r.id),
    items: (r.items || []).map((i: any) => ({ ...i, id: String(i.id) })),
  };
}

// GET /api/returns?fromDate=&toDate=
export class ReturnController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { fromDate, toDate } = req.query as Record<string, string>;
      const where: any = {};
      if (fromDate || toDate) {
        where.date = {};
        if (fromDate) where.date.gte = fromDate;
        if (toDate)   where.date.lte = toDate;
      }
      const returns = await prisma.return.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
      return ApiResponse.success(res, 'Returns fetched.', returns.map(formatReturn));
    } catch (e) { next(e); }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const {
        billNumber, date, customer, returnType, refundAmount,
        paymentMethod, reason, status, items,
      } = req.body;

      if (!billNumber || !date || !returnType || !refundAmount) {
        return ApiResponse.error(res, 'billNumber, date, returnType, and refundAmount are required.', 400);
      }

      const processedBy = req.user?.email || 'unknown';

      const saleId = parseInt(billNumber, 10);
      const saleExists = !isNaN(saleId) && await prisma.sale.findUnique({ where: { id: saleId } });

      const ret = await prisma.$transaction(async (tx) => {
        const created = await tx.return.create({
          data: {
            saleId: saleExists ? saleId : null,
            billNumber,
            date,
            customer: customer || 'Walk-in',
            returnType,
            refundAmount: Number(refundAmount),
            paymentMethod: paymentMethod || 'Cash',
            reason: reason || '',
            status: status || 'Completed',
            processedBy,
            items: {
              create: (items || []).map((i: any) => ({
                itemId: String(i.itemId || ''),
                name: i.name || '',
                returnQty: Number(i.returnQty || 0),
                unitPrice: Number(i.unitPrice || 0),
                refundAmount: Number(i.refundAmount || 0),
              })),
            },
          },
          include: { items: true },
        });

        // Restock inventory for milk/yogurt (and known F2 names as inventory if present)
        for (const item of created.items) {
          const qty = Number(item.returnQty) || 0;
          if (qty <= 0) continue;
          const nameKey = (item.name || '').trim().toLowerCase();
          if (!nameKey) continue;

          const code = nameKey.toUpperCase();
          const product =
            (await tx.inventoryProduct.findFirst({ where: { code } })) ||
            (await tx.inventoryProduct.findFirst({
              where: { OR: [{ name: nameKey }, { name: { contains: nameKey } }] },
            }));

          if (product) {
            await tx.inventoryMovement.create({
              data: {
                productId: product.id,
                quantity: Math.round(qty * 100) / 100,
                movementType: 'RETURN',
                source: 'Customer Return',
                reference: `return-${created.id}-${product.id}-${Date.now()}`,
                userId: req.user?.userId,
              },
            });
          }

          // F2 daily stock bump for lassi/butter/ghee
          if (['lassi', 'butter', 'ghee'].includes(nameKey)) {
            const dayStart = new Date(date + 'T00:00:00');
            if (!isNaN(dayStart.getTime())) {
              const stock = await tx.milkProductDailyStock.findUnique({ where: { date: dayStart } });
              if (stock) {
                if (nameKey === 'lassi') {
                  await tx.milkProductDailyStock.update({
                    where: { date: dayStart },
                    data: {
                      lassiSold: { decrement: qty },
                      lassiRemaining: { increment: qty },
                    },
                  });
                } else if (nameKey === 'butter') {
                  await tx.milkProductDailyStock.update({
                    where: { date: dayStart },
                    data: {
                      butterSold: { decrement: qty },
                      butterClosing: { increment: qty },
                    },
                  });
                } else if (nameKey === 'ghee') {
                  await tx.milkProductDailyStock.update({
                    where: { date: dayStart },
                    data: {
                      gheeSold: { decrement: qty },
                      gheeClosing: { increment: qty },
                    },
                  });
                }
              }
            }
          }
        }

        return created;
      });

      return ApiResponse.success(res, 'Return created.', formatReturn(ret), 201);
    } catch (e) { next(e); }
  }

  // GET /api/returns/bill/:billNumber — fetch sale info for a return lookup
  static async lookupBill(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { billNumber } = req.params;
      const saleId = parseInt(billNumber, 10);
      if (isNaN(saleId)) return ApiResponse.error(res, 'Invalid bill number.', 400);

      const sale = await prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: true, customer: true },
      });
      if (!sale) return ApiResponse.error(res, `Bill #${billNumber} not found.`, 404);

      // Map to MockBill shape the frontend expects
      const bill = {
        billNumber: String(sale.id),
        date: sale.createdAt.toISOString().split('T')[0],
        customer: sale.customer?.name || sale.customerName || 'Walk-in',
        paymentMethod: sale.saleType === 'walk_in' ? 'Cash' : 'Khata',
        total: sale.totalAmount,
        cashier: 'System',
        items: (sale.items || []).map(i => ({
          id:        String(i.id),
          name:      i.itemName,
          category:  i.itemName,
          quantity:  i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.totalPrice,
        })),
      };
      return ApiResponse.success(res, 'Bill found.', bill);
    } catch (e) { next(e); }
  }
}
