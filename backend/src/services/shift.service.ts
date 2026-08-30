import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
const money = (value: number) => Math.round(value * 100) / 100;

function formatShift(shift: any, salesAggregates?: {
  billsCount: number;
  grossSales: number;
  cashSales: number;
  onlineSales: number;
  khataSales: number;
}) {
  return {
    id: `SHIFT-${shift.shiftDate}`,
    date: shift.shiftDate,
    openedBy: shift.openedBy.name || shift.openedBy.email,
    openedAt: shift.openedAt.toISOString(),
    openingCash: shift.openingCash,
    openingNotes: shift.openingNotes || undefined,
    closedBy: shift.closedBy ? (shift.closedBy.name || shift.closedBy.email) : undefined,
    closedAt: shift.closedAt?.toISOString(),
    expectedCash: shift.expectedCash,
    countedCash: shift.countedCash ?? undefined,
    difference: shift.difference ?? undefined,
    differenceStatus: shift.differenceStatus ?? undefined,
    closingNotes: shift.closingNotes || undefined,
    status: shift.status,
    // Sales aggregates for Cash Register screen
    billsCount:   salesAggregates?.billsCount   ?? 0,
    grossSales:   salesAggregates?.grossSales    ?? 0,
    cashSales:    salesAggregates?.cashSales     ?? 0,
    onlineSales:  salesAggregates?.onlineSales   ?? 0,
    khataSales:   salesAggregates?.khataSales    ?? 0,
  };
}

async function getSalesAggregates(openedAt: Date, closedAt?: Date | null) {
  const dateFilter = { gte: openedAt, ...(closedAt ? { lte: closedAt } : {}) };

  const sales = await prisma.sale.findMany({
    where: { createdAt: dateFilter },
    include: { payments: true },
  });

  let billsCount = sales.length;
  let grossSales = 0;
  let cashSales = 0;
  let onlineSales = 0;
  let khataSales = 0;

  for (const sale of sales) {
    grossSales = money(grossSales + sale.totalAmount);
    if (sale.saleType === 'walk_in') {
      const method = sale.payments[0]?.method;
      if (method === 'online') onlineSales = money(onlineSales + sale.totalAmount);
      else cashSales = money(cashSales + sale.totalAmount);
    } else if (sale.saleType === 'split') {
      cashSales = money(cashSales + (sale.payments[0]?.amount ?? 0));
    } else {
      khataSales = money(khataSales + sale.totalAmount);
    }
  }

  return { billsCount, grossSales, cashSales, onlineSales, khataSales };
}

async function withRelations(id: number) {
  return prisma.shift.findUnique({
    where: { id },
    include: { openedBy: true, closedBy: true },
  });
}

async function expectedCash(shift: {
  id: number;
  openingCash: number;
  openedAt: Date;
  closedAt?: Date | null;
}) {
  const payments = await prisma.payment.findMany({
    where: {
      method: 'cash',
      // Split sales store their upfront cash as "partial" until the sale is fully settled.
      status: { in: ['completed', 'partial'] },
      createdAt: { gte: shift.openedAt, ...(shift.closedAt ? { lte: shift.closedAt } : {}) },
    },
    select: { amount: true },
  });

  // Cash paid out for expenses during this shift (shop purchases / partial clears)
  const expenseCashOut = await prisma.expensePayment.aggregate({
    where: { shiftId: shift.id },
    _sum: { amount: true },
  });

  return money(
    shift.openingCash +
      payments.reduce((sum, payment) => sum + payment.amount, 0) -
      (expenseCashOut._sum.amount || 0)
  );
}

export class ShiftService {
  static async list() {
    const shifts = await prisma.shift.findMany({
      orderBy: [{ shiftDate: 'desc' }, { openedAt: 'desc' }],
      include: { openedBy: true, closedBy: true },
    });
    return Promise.all(shifts.map(async (shift) => {
      const [expCash, salesAgg] = await Promise.all([
        shift.status === 'Open' ? expectedCash(shift) : Promise.resolve(shift.expectedCash),
        getSalesAggregates(shift.openedAt, shift.closedAt),
      ]);
      return formatShift(
        shift.status === 'Open' ? { ...shift, expectedCash: expCash } : shift,
        salesAgg
      );
    }));
  }

  static async open(userId: number, openingCash: number, openingNotes?: string) {
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      return { success: false, statusCode: 400, message: 'Opening cash must be a non-negative number.' };
    }
    const shiftDate = new Date().toISOString().slice(0, 10);
    const existing = await prisma.shift.findFirst({ where: { status: 'Open' } });
    if (existing) return { success: false, statusCode: 409, message: 'Close the currently open shift before opening another.' };
    const shift = await prisma.$transaction(async (tx) => {
      const created = await tx.shift.create({
        data: { shiftDate, openedById: userId, openingCash, openingNotes: openingNotes?.trim() || null, expectedCash: openingCash },
        include: { openedBy: true, closedBy: true },
      });
      await SyncQueueService.enqueueCreate(tx, 'Shift', created.id, created, 1);
      return created;
    });
    return { success: true, statusCode: 201, data: formatShift(shift, { billsCount: 0, grossSales: 0, cashSales: 0, onlineSales: 0, khataSales: 0 }) };
  }

  static async close(userId: number, countedCash: number, closingNotes?: string) {
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return { success: false, statusCode: 400, message: 'Counted cash must be a non-negative number.' };
    }
    const current = await prisma.shift.findFirst({ where: { status: 'Open' }, orderBy: { openedAt: 'asc' } });
    if (!current) return { success: false, statusCode: 404, message: 'No open shift found.' };
    const closedAt = new Date();
    const expected = await expectedCash({ ...current, closedAt });
    const difference = money(countedCash - expected);
    const differenceStatus = difference === 0 ? 'Balanced' : difference < 0 ? 'Short' : 'Over';
    const updated = await prisma.$transaction(async (tx) => {
      const closed = await tx.shift.update({
        where: { id: current.id },
        data: { closedById: userId, closedAt, countedCash, expectedCash: expected, difference, differenceStatus, closingNotes: closingNotes?.trim() || null, status: 'Closed' },
        include: { openedBy: true, closedBy: true },
      });
      await SyncQueueService.enqueueUpdate(tx, 'Shift', closed.id, closed, 1);
      return closed;
    });
    const salesAgg = await getSalesAggregates(current.openedAt, closedAt);
    return { success: true, statusCode: 200, data: formatShift(updated, salesAgg) };
  }
}