import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';

const money = (value: number) => Math.round(value * 100) / 100;

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function localDayStart(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

function previousLocalDay(date: Date): Date {
  const previous = localDayStart(date);
  previous.setDate(previous.getDate() - 1);
  return previous;
}

function nextLocalMidnight(): Date {
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  return next;
}

export async function resetLassiInventoryAtMidnight(): Promise<void> {
  const now = new Date();
  const dateKey = localDateKey(now);
  const reference = `lassi-midnight-reset-${dateKey}`;
  const lossDate = previousLocalDay(now);
  const lossDateKey = localDateKey(lossDate);
  const lossDateEnd = new Date(lossDate);
  lossDateEnd.setHours(23, 59, 59, 999);

  const lassi = await prisma.inventoryProduct.findFirst({
    where: { OR: [{ code: 'LASSI' }, { name: 'Lassi' }] },
  });
  if (!lassi) return;

  await prisma.$transaction(async (tx) => {
    const previousStock = await tx.milkProductDailyStock.findFirst({
      where: { date: { gte: lossDate, lte: lossDateEnd } },
    });
    const existingLoss = await tx.expense.findFirst({
      where: { description: `F2 milk cost not recovered from Lassi sales - ${lossDateKey}` },
    });
    if (previousStock && !existingLoss) {
      const rate = await tx.dailyRate.findFirst({
        where: { date: { lte: lossDateEnd } },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        select: { milkRate: true, lassiRate: true, butterRate: true },
      });
      const milkCost = money(Number(previousStock.milkTotal || 0) * Number(rate?.milkRate || 0));
      const lassiRecovery = money(Number(previousStock.lassiSold || 0) * Number(rate?.lassiRate || 0));
      const butterRecovery = money(Math.min(
        Number(previousStock.butterSold || 0) * Number(rate?.butterRate || 0),
        milkCost
      ));
      const milkRate = Number(rate?.milkRate || 0);
      const butterRecoveryKg = milkRate > 0 ? money(butterRecovery / milkRate) : 0;
      const lossCost = money(Math.max(milkCost - lassiRecovery - butterRecovery, 0));
      const remainingMilk = money(Math.max(
        Number(previousStock.milkTotal || 0) - Number(previousStock.lassiSold || 0) - butterRecoveryKg,
        0
      ));

      if (lossCost > 0) {
        const expense = await tx.expense.create({
          data: {
            date: lossDateKey,
            category: 'Milk',
            description: `F2 milk cost not recovered from Lassi sales - ${lossDateKey}`,
            quantity: remainingMilk,
            unitCost: Number(rate?.milkRate || 0),
            grossLoss: lossCost,
            soldRecovery: money(lassiRecovery + butterRecovery),
            netExpense: lossCost,
            amount: lossCost,
            paidAmount: 0,
            remaining: lossCost,
            reason: 'Milk remaining after daily Lassi sales was recorded as loss at midnight.',
            addedBy: 'System',
          },
        });
        await SyncQueueService.enqueueCreate(tx, 'Expense', expense.id, expense, 1);
      }
    }

    const existing = await tx.inventoryMovement.findUnique({ where: { reference } });
    if (!existing) {
      const current = Number((await tx.inventoryMovement.aggregate({
        where: { productId: lassi.id },
        _sum: { quantity: true },
      }))._sum.quantity || 0);
      const adjustment = money(-current);
      if (adjustment !== 0) {
        const movement = await tx.inventoryMovement.create({
          data: {
            productId: lassi.id,
            quantity: adjustment,
            movementType: 'ADJUSTMENT',
            source: 'Automatic midnight Lassi reset',
            reference,
            date: now,
          },
        });

        await SyncQueueService.enqueueCreate(tx, 'InventoryMovement', movement.id, movement, 2);
      }
    }

    const currentDayStart = localDayStart(now);
    const currentDayStock = await tx.milkProductDailyStock.findUnique({
      where: { date: currentDayStart },
    });
    if (!currentDayStock) {
      const newDayStock = await tx.milkProductDailyStock.create({
        data: { date: currentDayStart },
      });
      await SyncQueueService.enqueueCreate(tx, 'MilkProductDailyStock', newDayStock.id, newDayStock, 2);
    }
  });
}

export function startLassiMidnightReset(): NodeJS.Timeout {
  const scheduleNext = () => {
    const delay = Math.max(1000, nextLocalMidnight().getTime() - Date.now());
    return setTimeout(async () => {
      try {
        await resetLassiInventoryAtMidnight();
      } catch (error) {
        console.error('[LassiReset] Midnight reset failed:', error);
      }
      scheduleNext();
    }, delay);
  };

  const timer = scheduleNext();
  console.log(`[LassiReset] Scheduled for ${nextLocalMidnight().toLocaleString()}`);
  return timer;
}
