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

function isShiftAutoClosed(shift: any): boolean {
  if (shift.closedById == null && shift.status === 'Closed') return true;
  const notes = (shift.closingNotes || '').toLowerCase();
  return notes.includes('auto-close') || notes.includes('auto-closed') || notes.includes('midnight');
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
    closedById: isShiftAutoClosed(shift) ? undefined : (shift.closedById || undefined),
    closedBy: isShiftAutoClosed(shift) ? undefined : (shift.closedBy ? formatUserName(shift.closedBy) : undefined),
    isAutoClosed: isShiftAutoClosed(shift),
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
              closedById: null,
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

  static async getShiftLedger(shiftId: number) {
    const shift = await prisma.shift.findUnique({
      where: { id: shiftId },
      include: { openedBy: true, closedBy: true },
    });

    if (!shift) {
      return { success: false, statusCode: 404, message: 'Shift not found' };
    }

    const opAt = shift.openedAt;
    const clAt = shift.closedAt;
    const opId = shift.openedById;
    const openCash = Number(shift.openingCash) || 0;
    const expectedCashAmount = Number(shift.expectedCash) || 0;

    const baseWhere: any = {
      method: 'cash',
      status: { in: ['completed', 'partial'] },
      createdAt: { gte: opAt, ...(clAt ? { lte: clAt } : {}) },
    };

    const paymentsWithUser = await prisma.payment.findMany({
      where: {
        ...baseWhere,
        ...(opId ? {
          sale: {
            OR: [
              { createdById: opId },
              { createdById: null },
            ],
          },
        } : {}),
      },
      include: {
        sale: {
          select: {
            id: true,
            saleType: true,
            customerName: true,
            customerPhone: true,
            customerId: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const supplierPayments = await prisma.supplierPayment.findMany({
      where: {
        method: 'cash',
        shiftId: shift.id,
      },
      include: {
        supplier: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const expensePayments = await prisma.expensePayment.findMany({
      where: {
        shiftId: shift.id,
      },
      include: {
        expense: {
          select: { id: true, category: true, description: true, expenseType: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const sumP1 = paymentsWithUser.reduce((s, p) => s + Number(p.amount), 0);
    const sumSup = supplierPayments.reduce((s, sp) => s + Number(sp.amount), 0);
    const sumExp = expensePayments.reduce((s, ep) => s + Number(ep.amount), 0);

    let chosenPayments = paymentsWithUser;
    const calc1 = money(openCash + sumP1 - sumSup - sumExp);

    if (Math.abs(calc1 - expectedCashAmount) >= 0.001) {
      const allPayments = await prisma.payment.findMany({
        where: baseWhere,
        include: {
          sale: {
            select: {
              id: true,
              saleType: true,
              customerName: true,
              customerPhone: true,
              customerId: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
      const sumPAll = allPayments.reduce((s, p) => s + Number(p.amount), 0);
      if (Math.abs(money(openCash + sumPAll - sumSup - sumExp) - expectedCashAmount) < 0.001) {
        chosenPayments = allPayments;
      }
    }

    const rawItems: Array<{
      id: string;
      timestamp: string;
      rawTime: number;
      flowType: 'CASH_IN' | 'CASH_OUT';
      category: string;
      description: string;
      party: string;
      cashIn: number;
      cashOut: number;
      referenceId?: string;
    }> = [];

    rawItems.push({
      id: 'open-' + shift.id,
      timestamp: shift.openedAt.toISOString(),
      rawTime: shift.openedAt.getTime(),
      flowType: 'CASH_IN',
      category: 'Opening Cash',
      description: shift.openingNotes || 'Initial Cash Drawer Balance',
      party: formatUserName(shift.openedBy),
      cashIn: openCash,
      cashOut: 0,
      referenceId: 'SHIFT-' + shift.id,
    });

    for (const p of chosenPayments) {
      const isWalkIn = p.sale?.saleType === 'walk_in';
      const cat = isWalkIn ? 'Walk-in Customer Sale' : 'Customer Khata Payment';
      const party = p.sale?.customerName || (isWalkIn ? 'Walk-in Customer' : 'Customer Account');
      const amt = Number(p.amount) || 0;
      const saleId = p.sale?.id || p.saleId || '';

      rawItems.push({
        id: 'pay-' + p.id,
        timestamp: p.createdAt.toISOString(),
        rawTime: p.createdAt.getTime(),
        flowType: 'CASH_IN',
        category: cat,
        description: 'Sale #' + saleId + ' (' + (p.sale?.saleType || 'cash') + ')',
        party,
        cashIn: amt,
        cashOut: 0,
        referenceId: saleId ? 'SALE-' + saleId : undefined,
      });
    }

    for (const sp of supplierPayments) {
      const amt = Number(sp.amount) || 0;
      const party = sp.supplier?.name || ('Supplier #' + sp.supplierId);
      const desc = sp.notes || 'Supplier Milk Payment / Cash Out';

      rawItems.push({
        id: 'sup-' + sp.id,
        timestamp: sp.createdAt.toISOString(),
        rawTime: sp.createdAt.getTime(),
        flowType: 'CASH_OUT',
        category: 'Supplier Payment',
        description: desc,
        party,
        cashIn: 0,
        cashOut: amt,
        referenceId: 'SUP-' + sp.id,
      });
    }

    for (const ep of expensePayments) {
      const amt = Number(ep.amount) || 0;
      const cat = ep.expense?.category || 'Shop Expense';
      const desc = ep.expense?.description || cat;
      const party = ep.addedBy ? ('By ' + ep.addedBy) : 'Shop Staff';

      rawItems.push({
        id: 'exp-' + ep.id,
        timestamp: ep.createdAt.toISOString(),
        rawTime: ep.createdAt.getTime(),
        flowType: 'CASH_OUT',
        category: 'Shop Expense',
        description: desc,
        party,
        cashIn: 0,
        cashOut: amt,
        referenceId: 'EXP-' + ep.id,
      });
    }

    rawItems.sort((a, b) => {
      if (a.rawTime !== b.rawTime) return a.rawTime - b.rawTime;
      if (a.category === 'Opening Cash') return -1;
      if (b.category === 'Opening Cash') return 1;
      return 0;
    });

    let runningBalance = 0;
    const ledger = rawItems.map((item) => {
      if (item.flowType === 'CASH_IN') {
        runningBalance = money(runningBalance + item.cashIn);
      } else {
        runningBalance = money(runningBalance - item.cashOut);
      }
      return {
        ...item,
        runningBalance,
      };
    });

    const walkInTotal = chosenPayments
      .filter((p) => p.sale?.saleType === 'walk_in')
      .reduce((s, p) => s + Number(p.amount), 0);
    const khataTotal = chosenPayments
      .filter((p) => p.sale?.saleType !== 'walk_in')
      .reduce((s, p) => s + Number(p.amount), 0);
    const supplierTotal = supplierPayments.reduce((s, sp) => s + Number(sp.amount), 0);
    const expenseTotal = expensePayments.reduce((s, ep) => s + Number(ep.amount), 0);
    const totalCashIn = money(openCash + walkInTotal + khataTotal);
    const totalCashOut = money(supplierTotal + expenseTotal);

    return {
      success: true,
      statusCode: 200,
      data: {
        shiftId: shift.id,
        shiftDate: shift.shiftDate,
        status: shift.status,
        openedBy: formatUserName(shift.openedBy),
        openedAt: shift.openedAt.toISOString(),
        closedBy: isShiftAutoClosed(shift) ? undefined : (shift.closedBy ? formatUserName(shift.closedBy) : undefined),
        isAutoClosed: isShiftAutoClosed(shift),
        closedAt: shift.closedAt?.toISOString(),
        summary: {
          openingCash: openCash,
          walkInCashSales: money(walkInTotal),
          customerKhataPayments: money(khataTotal),
          totalCashIn,
          supplierCashOut: money(supplierTotal),
          expenseCashOut: money(expenseTotal),
          totalCashOut,
          expectedCash: shift.expectedCash,
          countedCash: shift.countedCash ?? undefined,
          difference: shift.difference ?? undefined,
          differenceStatus: shift.differenceStatus ?? undefined,
          isBalanced: Math.abs(runningBalance - Number(shift.expectedCash)) < 0.01,
        },
        ledger,
      },
    };
  }
}
