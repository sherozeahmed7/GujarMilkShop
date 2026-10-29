import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
import { NotificationService } from './notification.service';
const money = (value: number) => Math.round(value * 100) / 100;

function formatUserName(user?: { name?: string | null; email?: string | null; role?: string | null } | null): string {
  if (!user) return '—';
  const name = user.name?.trim();
  if (name && !name.includes('@')) {
    return name;
  }
  if (user.role?.toLowerCase() === 'super_admin' || user.role?.toLowerCase() === 'admin' || user.email?.startsWith('admin@')) {
    return 'Admin';
  }
  if (name && name.includes('@')) {
    const prefix = name.split('@')[0];
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  if (user.email) {
    const prefix = user.email.split('@')[0];
    return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return user.role || 'User';
}

function formatShift(shift: any, salesAggregates?: {
  billsCount: number;
  grossSales: number;
  cashSales: number;
  onlineSales: number;
  khataSales: number;
}) {
  return {
    id: shift.id != null ? `SHIFT-${shift.id}` : `SHIFT-${shift.shiftDate}`,
    date: shift.shiftDate,
    openedById: shift.openedById,
    openedBy: formatUserName(shift.openedBy),
    openedAt: shift.openedAt.toISOString(),
    openingCash: shift.openingCash,
    openingNotes: shift.openingNotes || undefined,
    closedById: shift.closedById || undefined,
    closedBy: shift.closedBy ? formatUserName(shift.closedBy) : undefined,
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

async function getSalesAggregates(openedAt: Date, closedAt?: Date | null, openedById?: number) {
  const dateFilter = { gte: openedAt, ...(closedAt ? { lte: closedAt } : {}) };

  const sales = await prisma.sale.findMany({
    where: {
      createdAt: dateFilter,
      ...(openedById ? {
        OR: [
          { createdById: openedById },
          { createdById: null }
        ]
      } : {})
    },
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
  openedById?: number;
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
      ...(shift.openedById ? {
        sale: {
          OR: [
            { createdById: shift.openedById },
            { createdById: null }
          ]
        }
      } : {})
    },
    select: { amount: true },
  });

  // Cash paid out for expenses during this shift (shop purchases / partial clears)
  const expenseCashOut = await prisma.expensePayment.aggregate({
    where: { shiftId: shift.id },
    _sum: { amount: true },
  });

  const supplierCashOut = await prisma.supplierPayment.aggregate({
    where: { shiftId: shift.id, method: 'cash' },
    _sum: { amount: true },
  });

  return money(
    shift.openingCash +
      payments.reduce((sum, payment) => sum + payment.amount, 0) -
      (expenseCashOut._sum.amount || 0) -
      (supplierCashOut._sum.amount || 0)
  );
}

export class ShiftService {
  static async autoClosePastMidnightShifts(): Promise<void> {
    try {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');
      const todayYMD = `${y}-${m}-${d}`;

      const openShifts = await prisma.shift.findMany({
        where: { status: 'Open' },
        include: { openedBy: true },
      });

      for (const shift of openShifts) {
        const isPastMidnight = shift.shiftDate < todayYMD;
        if (!isPastMidnight) continue;

        let closedAt: Date;
        if (/^\d{4}-\d{2}-\d{2}$/.test(shift.shiftDate)) {
          const [sYear, sMonth, sDay] = shift.shiftDate.split('-').map(Number);
          closedAt = new Date(sYear, sMonth - 1, sDay, 23, 59, 59, 999);
        } else {
          closedAt = new Date(shift.openedAt);
          closedAt.setHours(23, 59, 59, 999);
        }

        const expected = await expectedCash({ ...shift, closedAt });

        const updated = await prisma.$transaction(async (tx) => {
          const closed = await tx.shift.update({
            where: { id: shift.id },
            data: {
              closedById: shift.openedById,
              closedAt,
              countedCash: expected,
              expectedCash: expected,
              difference: 0,
              differenceStatus: 'Balanced',
              closingNotes: 'Auto-closed at midnight (12:00 AM)',
              status: 'Closed',
            },
            include: { openedBy: true, closedBy: true },
          });
          await SyncQueueService.enqueueUpdate(tx, 'Shift', closed.id, closed, 1);
          return closed;
        });

        NotificationService.create({
          category: 'shift',
          title: 'Shift Auto-Closed at Midnight',
          message: `Shift for ${shift.shiftDate} was auto-closed at midnight with balanced cash of Rs. ${expected.toLocaleString()}.`,
          actionUrl: '/shifts',
          actionLabel: 'View Shifts',
          metadata: { shiftId: updated.id, expectedCash: expected, status: 'Closed' },
        }).catch(() => {});

        console.log(`[ShiftAutoClose] Auto-closed shift #${shift.id} (${shift.shiftDate}) at midnight with expected cash Rs. ${expected}`);
      }
    } catch (err: any) {
      console.error('[ShiftAutoClose] Error auto-closing past midnight shifts:', err?.message);
    }
  }

  static async list(userId?: number) {
    await ShiftService.autoClosePastMidnightShifts();
    const where: any = {};
    if (userId) {
      where.openedById = userId;
    }
    const shifts = await prisma.shift.findMany({
      where,
      orderBy: [{ shiftDate: 'desc' }, { openedAt: 'desc' }],
      include: { openedBy: true, closedBy: true },
    });
    return Promise.all(shifts.map(async (shift) => {
      const [expCash, salesAgg] = await Promise.all([
        shift.status === 'Open' ? expectedCash({ ...shift, openedById: shift.openedById }) : Promise.resolve(shift.expectedCash),
        getSalesAggregates(shift.openedAt, shift.closedAt, shift.openedById),
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
    await ShiftService.autoClosePastMidnightShifts();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const shiftDate = `${y}-${m}-${d}`;
    const existing = await prisma.shift.findFirst({ where: { status: 'Open', openedById: userId } });
    if (existing) return { success: false, statusCode: 409, message: 'Close your currently open shift before opening another.' };
    const shift = await prisma.$transaction(async (tx) => {
      const created = await tx.shift.create({
        data: { shiftDate, openedById: userId, openingCash, openingNotes: openingNotes?.trim() || null, expectedCash: openingCash },
        include: { openedBy: true, closedBy: true },
      });
      await SyncQueueService.enqueueCreate(tx, 'Shift', created.id, created, 1);
      return created;
    });

    NotificationService.create({
      category: 'shift',
      title: 'Shift Opened',
      message: `Shift opened by ${formatUserName(shift.openedBy)} with Rs. ${shift.openingCash.toLocaleString()} opening cash.`,
      metadata: { shiftId: shift.id, openedBy: formatUserName(shift.openedBy), openingCash: shift.openingCash },
    }).catch(() => {});

    return { success: true, statusCode: 201, data: formatShift(shift, { billsCount: 0, grossSales: 0, cashSales: 0, onlineSales: 0, khataSales: 0 }) };
  }

  static async close(userId: number, countedCash: number, closingNotes?: string) {
    if (!Number.isFinite(countedCash) || countedCash < 0) {
      return { success: false, statusCode: 400, message: 'Counted cash must be a non-negative number.' };
    }
    const current = await prisma.shift.findFirst({ where: { status: 'Open', openedById: userId }, orderBy: { openedAt: 'desc' } });
    if (!current) return { success: false, statusCode: 404, message: 'No open shift found for your account.' };
    const closedAt = new Date();
    const expected = await expectedCash({ ...current, openedById: current.openedById, closedAt });
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

    if (difference !== 0) {
      NotificationService.create({
        category: 'shift',
        title: 'Cash Difference Alert',
        message: `Register is Rs. ${Math.abs(difference).toLocaleString()} ${differenceStatus} (Expected: Rs. ${expected.toLocaleString()}, Counted: Rs. ${countedCash.toLocaleString()}).`,
        actionUrl: '/cash-register',
        actionLabel: 'Review Cash Register',
        metadata: { shiftId: updated.id, countedCash, expectedCash: expected, difference, differenceStatus },
      }).catch(() => {});
    } else {
      NotificationService.create({
        category: 'shift',
        title: 'Shift Closed (Balanced)',
        message: `Shift closed by ${formatUserName(updated.closedBy)} with balanced cash of Rs. ${countedCash.toLocaleString()}.`,
        actionUrl: '/shifts',
        actionLabel: 'View Shifts',
        metadata: { shiftId: updated.id, countedCash, expectedCash: expected, difference: 0, differenceStatus: 'Balanced' },
      }).catch(() => {});
    }

    const salesAgg = await getSalesAggregates(current.openedAt, closedAt);
    return { success: true, statusCode: 200, data: formatShift(updated, salesAgg) };
  }
}