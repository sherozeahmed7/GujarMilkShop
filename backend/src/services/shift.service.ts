import { prisma } from '../config/database';

const money = (value: number) => Math.round(value * 100) / 100;

function formatShift(shift: any) {
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
  };
}

async function withRelations(id: number) {
  return prisma.shift.findUnique({
    where: { id },
    include: { openedBy: true, closedBy: true },
  });
}

async function expectedCash(shift: { openingCash: number; openedAt: Date; closedAt?: Date | null }) {
  const payments = await prisma.payment.findMany({
    where: {
      method: 'cash',
      // Split sales store their upfront cash as "partial" until the sale is fully settled.
      status: { in: ['completed', 'partial'] },
      createdAt: { gte: shift.openedAt, ...(shift.closedAt ? { lte: shift.closedAt } : {}) },
    },
    select: { amount: true },
  });
  return money(shift.openingCash + payments.reduce((sum, payment) => sum + payment.amount, 0));
}

export class ShiftService {
  static async list() {
    const shifts = await prisma.shift.findMany({
      orderBy: [{ shiftDate: 'desc' }, { openedAt: 'desc' }],
      include: { openedBy: true, closedBy: true },
    });
    return Promise.all(shifts.map(async (shift) => {
      if (shift.status !== 'Open') return formatShift(shift);
      return formatShift({ ...shift, expectedCash: await expectedCash(shift) });
    }));
  }

  static async open(userId: number, openingCash: number, openingNotes?: string) {
    if (!Number.isFinite(openingCash) || openingCash < 0) {
      return { success: false, statusCode: 400, message: 'Opening cash must be a non-negative number.' };
    }
    const shiftDate = new Date().toISOString().slice(0, 10);
    const existing = await prisma.shift.findFirst({ where: { status: 'Open' } });
    if (existing) return { success: false, statusCode: 409, message: 'Close the currently open shift before opening another.' };
    const shift = await prisma.shift.create({
      data: { shiftDate, openedById: userId, openingCash, openingNotes: openingNotes?.trim() || null, expectedCash: openingCash },
      include: { openedBy: true, closedBy: true },
    });
    return { success: true, statusCode: 201, data: formatShift(shift) };
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
    const updated = await prisma.shift.update({
      where: { id: current.id },
      data: { closedById: userId, closedAt, countedCash, expectedCash: expected, difference, differenceStatus, closingNotes: closingNotes?.trim() || null, status: 'Closed' },
      include: { openedBy: true, closedBy: true },
    });
    return { success: true, statusCode: 200, data: formatShift(updated) };
  }
}