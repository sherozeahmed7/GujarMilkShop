import crypto from 'crypto';
import { prisma } from '../config/database';
import { Prisma } from '@prisma/client';
import { SyncQueueService } from './syncQueue.service';
const CYCLE_TYPES = ['Monthly Cycle', '1-Day Cycle', 'Weekly Cycle'];
const SHIFTS = ['Morning', 'Evening'];
const MILK_TYPES = ['Mixed', 'Cow', 'Buffalo'];
const money = (value: number) => Math.round(value * 100) / 100;

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD start of current cycle for a supplier (local calendar). */
function supplierPeriodStart(cycleType: string, now = new Date()): string {
  if (cycleType === '1-Day Cycle') {
    return localDateKey(now);
  }
  if (cycleType === 'Weekly Cycle') {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dow = d.getDay(); // 0 = Sun
    const offset = dow === 0 ? 6 : dow - 1; // Monday start
    d.setDate(d.getDate() - offset);
    return localDateKey(d);
  }
  // Monthly Cycle (default)
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function shape(
  supplier: any,
  collections: any[] = [],
  payments: any[] = [],
  rangeStart?: string | null,
  rangeEnd?: string | null
) {
  const purchased = collections.reduce((sum, item) => sum + item.amount, 0);
  const paid = payments.reduce((sum, item) => sum + item.amount, 0);
  const advance = Number(supplier.guaranteedAdvance) || 0;

  const openingCollection = collections.find((c: any) => c.notes === 'Opening Balance');
  const openingBalance = openingCollection ? money(openingCollection.amount) : 0;

  const periodStart = rangeStart || supplierPeriodStart(supplier.cycleType);
  let prevPurchased = 0;
  let currPurchased = 0;
  for (const item of collections) {
    const d = String(item.date);
    if (d < periodStart) prevPurchased += item.amount;
    else if (!rangeEnd || d <= rangeEnd) currPurchased += item.amount;
  }

  // Period columns = purchases only (not net of payments)
  const currentAmount = money(currPurchased);
  const previousAmount = money(prevPurchased);
  // Amount we have to pay after advance (before payments)
  const totalAmount = money(purchased - advance);
  const paidAmount = money(paid);
  // Remaining = Total to Pay − Paid (= purchased − paid − advance)
  const remainingBalance = money(totalAmount - paidAmount);

  return {
    id: String(supplier.id),
    name: supplier.name,
    code: supplier.code,
    phone: supplier.phone || '',
    defaultRate: supplier.defaultRate,
    cowRate: supplier.cowRate,
    buffaloRate: supplier.buffaloRate,
    cycleType: supplier.cycleType,
    isActive: supplier.isActive,
    guaranteedAdvance: advance,
    openingBalance,
    grossPayable: money(purchased - paid),
    currentAmount,
    previousAmount,
    totalAmount,
    paidAmount,
    remainingBalance,
    /** @deprecated alias of remainingBalance */
    payableBalance: remainingBalance,
    nextCycleCredit: advance,
  };
}

export async function generateUniqueSupplierCode(tx: Prisma.TransactionClient | typeof prisma): Promise<string> {
  const existingSuppliers = await tx.supplier.findMany({
    select: { id: true, code: true }
  });

  const syncQueueRecords = await tx.syncQueue.findMany({
    where: { entityType: 'Supplier' },
    select: { localId: true, payload: true }
  });

  const usedCodes = new Set<string>();
  let maxNum = 0;

  const registerCode = (codeStr?: string | null, localId?: number | null) => {
    if (!codeStr) return;
    const clean = String(codeStr).trim().toUpperCase();
    if (!clean) return;
    usedCodes.add(clean);

    const supMatch = clean.match(/^SUP-(\d+)$/i);
    if (supMatch) {
      const n = parseInt(supMatch[1], 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  };

  for (const s of existingSuppliers) {
    registerCode(s.code, s.id);
  }

  for (const q of syncQueueRecords) {
    try {
      const payload = typeof q.payload === 'string' ? JSON.parse(q.payload) : q.payload;
      registerCode(payload?.code, q.localId);
    } catch {
      // ignore
    }
  }

  let nextNum = maxNum + 1;
  let candidate = `SUP-${String(nextNum).padStart(4, '0')}`;

  while (usedCodes.has(candidate.toUpperCase())) {
    nextNum++;
    candidate = `SUP-${String(nextNum).padStart(4, '0')}`;
  }

  return candidate;
}

export class SupplierService {
  static async getNextCode() {
    return await generateUniqueSupplierCode(prisma);
  }

  static async list(filters?: {
    cycleType?: string;
    fromDate?: string;
    toDate?: string;
    isActive?: boolean;
  }) {
    const where: any = {};
    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }
    if (filters?.cycleType && CYCLE_TYPES.includes(filters.cycleType)) {
      where.cycleType = filters.cycleType;
    }

    let rangeStart: string | null = null;
    let rangeEnd: string | null = null;
    if (filters?.fromDate) {
      if (filters.fromDate.length === 10) rangeStart = filters.fromDate;
      else {
        const d = new Date(filters.fromDate);
        if (!Number.isNaN(d.getTime())) rangeStart = localDateKey(d);
      }
    }
    if (filters?.toDate) {
      if (filters.toDate.length === 10) rangeEnd = filters.toDate;
      else {
        const d = new Date(filters.toDate);
        if (!Number.isNaN(d.getTime())) rangeEnd = localDateKey(d);
      }
    }

    // 1. Fetch suppliers + opening balances
    // NOTE: Keep all suppliers visible across filters; do not restrict `suppliers` list by collections date
    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        collections: {
          where: { notes: 'Opening Balance' },
          take: 1,
          select: { amount: true }
        }
      }
    });

    if (suppliers.length === 0) return [];

    const supplierIds = suppliers.map((s) => s.id);
    const now = new Date();
    const isFiltered = Boolean(rangeStart || rangeEnd);

    // Group suppliers by cycleType to determine current period
    const cycleGroups: Record<string, number[]> = {};
    for (const s of suppliers) {
      const c = s.cycleType || 'Monthly Cycle';
      if (!cycleGroups[c]) cycleGroups[c] = [];
      cycleGroups[c].push(s.id);
    }

    // 2. Parallel aggregates
    // When a date range filter is provided:
    // - purchasedAgg & paidAgg must only reflect activity inside the range
    // - shiftAgg reflects milk inside the range
    // When All Time:
    // - purchasedAgg & paidAgg reflect all-time historical activity
    const dateFilterObj: any = {};
    if (rangeStart) dateFilterObj.gte = rangeStart;
    if (rangeEnd) dateFilterObj.lte = rangeEnd;
    const hasDateFilter = Object.keys(dateFilterObj).length > 0;

    const filterCollectionsWhere: any = {
      supplierId: { in: supplierIds },
      ...(hasDateFilter ? { date: dateFilterObj } : {}),
    };

    const filterPaymentsWhere: any = {
      supplierId: { in: supplierIds },
      ...(hasDateFilter ? { date: dateFilterObj } : {}),
    };

    const aggPromises: Promise<any>[] = [
      prisma.supplierCollection.groupBy({
        by: ['supplierId'],
        where: isFiltered ? filterCollectionsWhere : { supplierId: { in: supplierIds } },
        _sum: { amount: true }
      }),
      prisma.supplierPayment.groupBy({
        by: ['supplierId'],
        where: isFiltered ? filterPaymentsWhere : { supplierId: { in: supplierIds } },
        _sum: { amount: true }
      }),
      prisma.supplierCollection.groupBy({
        by: ['supplierId', 'shift'],
        where: filterCollectionsWhere,
        _sum: { quantity: true, amount: true }
      }),
    ];

    // Current and Previous period aggregations
    // Only calculate historical cycle groupings when All Time.
    // When date-filtered, Current Cycle is the period purchases and Previous Cycle is 0.
    const cycleKeys = Object.keys(cycleGroups);
    if (!isFiltered) {
      for (const cycle of cycleKeys) {
        const pStart = supplierPeriodStart(cycle, now);
        
        // Current Period
        aggPromises.push(
          prisma.supplierCollection.groupBy({
            by: ['supplierId'],
            where: {
              supplierId: { in: cycleGroups[cycle] },
              date: { gte: pStart }
            },
            _sum: { amount: true }
          }).then(res => ({ cycle, type: 'current', data: res }))
        );

        // Previous Period (Strictly before pStart)
        aggPromises.push(
          prisma.supplierCollection.groupBy({
            by: ['supplierId'],
            where: {
              supplierId: { in: cycleGroups[cycle] },
              date: { lt: pStart }
            },
            _sum: { amount: true }
          }).then(res => ({ cycle, type: 'previous', data: res }))
        );
      }
    }

    const results = await Promise.all(aggPromises);
    const purchasedAgg = results[0];
    const paidAgg = results[1];
    const shiftAgg = results[2];
    
    const purchasedMap = new Map<number, number>(purchasedAgg.map((r: any) => [r.supplierId, r._sum.amount || 0]));
    const paidMap = new Map<number, number>(paidAgg.map((r: any) => [r.supplierId, r._sum.amount || 0]));
    
    // Process shift milk quantities and totals for the filtered range
    const shiftStatsMap = new Map<number, { morningQty: number; eveningQty: number; totalQty: number; totalAmount: number }>();
    for (const row of (shiftAgg || [])) {
      const sId = row.supplierId;
      if (!shiftStatsMap.has(sId)) {
        shiftStatsMap.set(sId, { morningQty: 0, eveningQty: 0, totalQty: 0, totalAmount: 0 });
      }
      const stat = shiftStatsMap.get(sId)!;
      const q = money(row._sum.quantity || 0);
      const a = money(row._sum.amount || 0);
      if (row.shift === 'Morning') {
        stat.morningQty = money(stat.morningQty + q);
      } else if (row.shift === 'Evening') {
        stat.eveningQty = money(stat.eveningQty + q);
      }
      stat.totalQty = money(stat.totalQty + q);
      stat.totalAmount = money(stat.totalAmount + a);
    }

    const currentPurchasedMap = new Map<number, number>();
    const previousPurchasedMap = new Map<number, number>();
    
    if (!isFiltered) {
      for (let i = 3; i < results.length; i++) {
        const { type, data } = results[i] as { type: string, data: any[] };
        for (const r of data) {
          if (type === 'current') currentPurchasedMap.set(r.supplierId, r._sum.amount || 0);
          if (type === 'previous') previousPurchasedMap.set(r.supplierId, r._sum.amount || 0);
        }
      }
    }

    // 3. Assemble response
    return suppliers.map((s) => {
      const purchased = purchasedMap.get(s.id) || 0;
      const paid = paidMap.get(s.id) || 0;
      // Advance is only applicable all-time (or if period has an advance rule); when filtered to a period, Advance = 0 unless all time
      const advance = !isFiltered ? (Number(s.guaranteedAdvance) || 0) : 0;
      
      const openingBalance = (!isFiltered && s.collections?.[0]) ? money(s.collections[0].amount) : 0;
      
      const currentAmount = isFiltered ? money(purchased) : money(currentPurchasedMap.get(s.id) || 0);
      const previousAmount = isFiltered ? 0 : money(previousPurchasedMap.get(s.id) || 0);
      const totalAmount = money(purchased - advance);
      const paidAmount = money(paid);
      const remainingBalance = money(totalAmount - paidAmount);

      const shiftStats = shiftStatsMap.get(s.id) || { morningQty: 0, eveningQty: 0, totalQty: 0, totalAmount: 0 };
      const effectiveRate = shiftStats.totalQty > 0
        ? money(shiftStats.totalAmount / shiftStats.totalQty)
        : (s.defaultRate || 0);

      return {
        id: String(s.id),
        name: s.name,
        code: s.code,
        phone: s.phone || '',
        defaultRate: s.defaultRate,
        cowRate: s.cowRate,
        buffaloRate: s.buffaloRate,
        cycleType: s.cycleType,
        isActive: s.isActive,
        guaranteedAdvance: advance,
        openingBalance,
        grossPayable: money(purchased - paid),
        currentAmount,
        previousAmount,
        totalAmount,
        paidAmount,
        remainingBalance,
        payableBalance: remainingBalance, // deprecated alias
        nextCycleCredit: advance,
        morningQty: shiftStats.morningQty,
        eveningQty: shiftStats.eveningQty,
        totalQty: shiftStats.totalQty,
        rate: effectiveRate,
        periodPurchases: shiftStats.totalAmount,
      };
    });
  }

  static async get(id: number) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: { collections: true, payments: true },
    });
    if (!supplier) return { success: false, statusCode: 404, message: 'Supplier not found.' };
    return { success: true, statusCode: 200, data: shape(supplier, supplier.collections, supplier.payments) };
  }

  static async create(payload: any) {
    if (!payload.name?.trim()) return { success: false, statusCode: 400, message: 'Supplier name is required.' };
    if (!CYCLE_TYPES.includes(payload.cycleType)) return { success: false, statusCode: 400, message: 'Invalid cycle type.' };
    try {
      const supplier = await prisma.$transaction(async (tx) => {
        let code = payload.code?.trim();
        if (!code) {
          code = await generateUniqueSupplierCode(tx);
        } else {
          const existing = await tx.supplier.findUnique({ where: { code } });
          if (existing) {
            code = await generateUniqueSupplierCode(tx);
          }
        }

        const created = await tx.supplier.create({ data: {
          name: payload.name.trim(),
          code,
          phone: payload.phone?.trim() || null,
          defaultRate: Number(payload.defaultRate) || 0,
          cowRate: Number(payload.cowRate) || 0,
          buffaloRate: Number(payload.buffaloRate) || 0,
          cycleType: payload.cycleType,
          isActive: payload.isActive !== false,
          guaranteedAdvance: Number(payload.guaranteedAdvance) || 0,
        }});
        await SyncQueueService.enqueueCreate(tx, 'Supplier', created.id, created, 0);

        if (payload.openingBalance !== undefined && Number(payload.openingBalance) > 0) {
          const opening = money(Number(payload.openingBalance));
          const periodStartStr = supplierPeriodStart(created.cycleType);
          const periodStartDate = new Date(periodStartStr);
          const openingDate = new Date(periodStartDate.getTime() - 24 * 60 * 60 * 1000);
          const openingDateStr = localDateKey(openingDate);

          const collection = await tx.supplierCollection.create({
            data: {
              supplierId: created.id,
              date: openingDateStr,
              shift: 'Morning',
              milkType: 'Mixed',
              quantity: 1,
              rate: opening,
              amount: opening,
              notes: 'Opening Balance',
              createdById: payload.createdById || null
            }
          });
          await SyncQueueService.enqueueCreate(tx, 'SupplierCollection', collection.id, collection, 1);
        }

        return created;
      });
      const [collections, payments] = await Promise.all([
        prisma.supplierCollection.findMany({ where: { supplierId: supplier.id } }),
        prisma.supplierPayment.findMany({ where: { supplierId: supplier.id } }),
      ]);
      return { success: true, statusCode: 201, data: shape(supplier, collections, payments) };
    } catch (e: any) {
      if (e.code === 'P2002') return { success: false, statusCode: 409, message: 'Supplier code already exists.' };
      return { success: false, statusCode: 500, message: e.message || 'Failed to create supplier.' };
    }
  }

  static async update(id: number, payload: any) {
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return { success: false, statusCode: 404, message: 'Supplier not found.' };
    const supplier = await prisma.$transaction(async (tx) => {
      const updated = await tx.supplier.update({ where: { id }, data: {
        ...(payload.name !== undefined ? { name: String(payload.name).trim() } : {}),
        ...(payload.code !== undefined ? { code: String(payload.code).trim() } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
        ...(payload.defaultRate !== undefined ? { defaultRate: Number(payload.defaultRate) } : {}),
        ...(payload.cowRate !== undefined ? { cowRate: Number(payload.cowRate) } : {}),
        ...(payload.buffaloRate !== undefined ? { buffaloRate: Number(payload.buffaloRate) } : {}),
        ...(payload.cycleType !== undefined ? { cycleType: payload.cycleType } : {}),
        ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}),
        ...(payload.guaranteedAdvance !== undefined ? { guaranteedAdvance: Number(payload.guaranteedAdvance) } : {}),
      }});

      if (payload.remainingBalance !== undefined || payload.openingBalance !== undefined) {
        const targetVal =
          payload.remainingBalance !== undefined
            ? Number(payload.remainingBalance)
            : Number(payload.openingBalance);

        if (!Number.isNaN(targetVal)) {
          const target = money(targetVal);

          const nonOpeningCollections = await tx.supplierCollection.findMany({
            where: {
              supplierId: id,
              notes: { not: 'Opening Balance' }
            }
          });
          const allPayments = await tx.supplierPayment.findMany({
            where: { supplierId: id }
          });

          const nonOpeningPurchased = nonOpeningCollections.reduce((sum, c) => sum + c.amount, 0);
          const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
          const adv = Number(updated.guaranteedAdvance) || 0;

          // Base balance without opening balance collection
          const baseBalance = money(nonOpeningPurchased - totalPaid - adv);
          const requiredOpening = money(target - baseBalance);

          const existingOpening = await tx.supplierCollection.findFirst({
            where: {
              supplierId: id,
              notes: 'Opening Balance'
            }
          });

          if (existingOpening) {
            if (requiredOpening <= 0) {
              const cloudUuid = await SyncQueueService.getCloudMapping('SupplierCollection', existingOpening.id, tx);
              if (cloudUuid) {
                await SyncQueueService.enqueueUpdate(tx, 'SupplierCollection', existingOpening.id, existingOpening, 1, 'DELETE');
              }
              await tx.supplierCollection.delete({ where: { id: existingOpening.id } });
            } else {
              const updatedColl = await tx.supplierCollection.update({
                where: { id: existingOpening.id },
                data: {
                  rate: requiredOpening,
                  amount: requiredOpening
                }
              });
              await SyncQueueService.enqueueUpdate(tx, 'SupplierCollection', updatedColl.id, updatedColl, 1);
            }
          } else if (requiredOpening > 0) {
            const periodStartStr = supplierPeriodStart(updated.cycleType);
            const periodStartDate = new Date(periodStartStr);
            const openingDate = new Date(periodStartDate.getTime() - 24 * 60 * 60 * 1000);
            const openingDateStr = localDateKey(openingDate);

            const collection = await tx.supplierCollection.create({
              data: {
                supplierId: id,
                date: openingDateStr,
                shift: 'Morning',
                milkType: 'Mixed',
                quantity: 1,
                rate: requiredOpening,
                amount: requiredOpening,
                notes: 'Opening Balance',
                createdById: payload.createdById || null
              }
            });
            await SyncQueueService.enqueueCreate(tx, 'SupplierCollection', collection.id, collection, 1);
          }
        }
      }

      await SyncQueueService.enqueueUpdate(tx, 'Supplier', updated.id, updated, 0);
      return updated;
    });
    const [collections, payments] = await Promise.all([
      prisma.supplierCollection.findMany({ where: { supplierId: id } }),
      prisma.supplierPayment.findMany({ where: { supplierId: id } }),
    ]);
    return { success: true, statusCode: 200, data: shape(supplier, collections, payments) };
  }

  static async collections(supplierId: number) {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return { success: false, statusCode: 404, message: 'Supplier not found.' };
    const [collections, payments] = await Promise.all([
      prisma.supplierCollection.findMany({ where: { supplierId }, orderBy: { date: 'desc' } }),
      prisma.supplierPayment.findMany({
        where: { supplierId },
        include: { shift: { select: { id: true, shiftDate: true, status: true } } },
        orderBy: { date: 'desc' },
      }),
    ]);
    return {
      success: true,
      statusCode: 200,
      data: {
        collections,
        payments: payments.map((p) => ({
          ...p,
          shiftDate: p.shift?.shiftDate ?? null,
          shiftStatus: p.shift?.status ?? null,
          shift: undefined,
        })),
      },
    };
  }

  static async saveCollection(userId: number, supplierId: number, payload: any, collectionId?: number) {
    const quantity = Number(payload.quantity), rate = Number(payload.rate);
    if (!SHIFTS.includes(payload.shift) || !MILK_TYPES.includes(payload.milkType) || !payload.date || quantity <= 0 || rate <= 0) return { success: false, statusCode: 400, message: 'Valid date, shift, milk type, quantity, and rate are required.' };
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) return { success: false, statusCode: 404, message: 'Supplier not found.' };
    try {
      const data = { date: payload.date, shift: payload.shift, milkType: payload.milkType, quantity, rate, amount: money(quantity * rate), notes: payload.notes?.trim() || null, createdById: userId };
      const collection = await prisma.$transaction(async (tx) => {
        const saved = collectionId
          ? await tx.supplierCollection.update({ where: { id: collectionId }, data })
          : await tx.supplierCollection.create({ data: { ...data, supplierId } });
        
        if (collectionId) {
          await SyncQueueService.enqueueUpdate(tx, 'SupplierCollection', saved.id, saved, 1);
        } else {
          await SyncQueueService.enqueueCreate(tx, 'SupplierCollection', saved.id, saved, 1);
        }

        const product = await tx.inventoryProduct.findFirst({ where: { code: 'MILK' } });
        const shift = await tx.shift.findFirst({ where: { status: 'Open' }, orderBy: { openedAt: 'asc' } });
        if (product) {
          const movement = await tx.inventoryMovement.upsert({
            where: { reference: `supplier-collection-${saved.id}` },
            create: { productId: product.id, quantity, movementType: 'STOCK_IN', source: 'Supplier Purchase', reference: `supplier-collection-${saved.id}`, unitCost: rate, supplierId, userId, shiftId: shift?.id, date: new Date(`${payload.date}T00:00:00`) },
            update: { productId: product.id, quantity, unitCost: rate, supplierId, userId, shiftId: shift?.id, date: new Date(`${payload.date}T00:00:00`) },
          });
          await SyncQueueService.enqueueUpdate(tx, 'InventoryMovement', movement.id, movement, 2, 'UPSERT');
        }
        return saved;
      });
      return { success: true, statusCode: collectionId ? 200 : 201, data: collection };
    } catch (error: any) {
      if (error.code === 'P2002') return { success: false, statusCode: 409, message: 'A collection already exists for this supplier, date, and shift.' };
      throw error;
    }
  }

  static async deleteCollection(id: number) {
    await prisma.$transaction(async (tx) => {
      // Find them first to get IDs for sync
      const collection = await tx.supplierCollection.findUnique({ where: { id } });
      const movements = await tx.inventoryMovement.findMany({ where: { reference: `supplier-collection-${id}` } });
      
      if (collection) {
        await tx.supplierCollection.delete({ where: { id } });
        await SyncQueueService.enqueueUpdate(tx, 'SupplierCollection', id, { id }, 1, 'DELETE');
      }
      
      if (movements.length > 0) {
        await tx.inventoryMovement.deleteMany({ where: { reference: `supplier-collection-${id}` } });
        for (const m of movements) {
          await SyncQueueService.enqueueUpdate(tx, 'InventoryMovement', m.id, { id: m.id }, 2, 'DELETE');
        }
      }
    });
    return { success: true, statusCode: 200, data: null };
  }

  static async addPayment(userId: number, supplierId: number, payload: any) {
    const clientUuid = typeof payload.clientUuid === 'string' && payload.clientUuid.trim() ? payload.clientUuid.trim() : null;

    // Idempotency check: If clientUuid is provided and already committed, return existing payment record immediately
    if (clientUuid) {
      const existing = await prisma.supplierPayment.findUnique({
        where: { cloudUuid: clientUuid },
      });
      if (existing) {
        return {
          success: true,
          statusCode: 200,
          data: existing,
        };
      }
    }

    const amount = Number(payload.amount ?? 0);
    const discount = Number(payload.discount ?? 0);
    if (!Number.isFinite(amount) || amount < 0) {
      return { success: false, statusCode: 400, message: 'Payment amount must be a valid number.' };
    }
    if (!Number.isFinite(discount) || discount < 0) {
      return { success: false, statusCode: 400, message: 'Discount must be a valid number.' };
    }
    if (amount <= 0 && discount <= 0) {
      return { success: false, statusCode: 400, message: 'Enter a payment amount and/or a discount greater than zero.' };
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { collections: true, payments: true },
    });
    if (!supplier) return { success: false, statusCode: 404, message: 'Supplier not found.' };

    const shaped = shape(supplier, supplier.collections, supplier.payments);
    const balance = Math.max(0, shaped.payableBalance);
    if (balance <= 0) {
      return {
        success: false,
        statusCode: 400,
        message: shaped.payableBalance < 0
          ? `Nothing to pay — advance credit of Rs. ${Math.abs(shaped.payableBalance)} is still available.`
          : 'Payable balance is zero.',
      };
    }

    const totalClear = Math.round((amount + discount) * 100) / 100;
    if (totalClear > balance) {
      return {
        success: false,
        statusCode: 400,
        message: `Payment + discount (Rs. ${totalClear}) cannot exceed payable Rs. ${balance} (after Rs. ${shaped.guaranteedAdvance} advance).`,
      };
    }

    const method = payload.method || 'cash';
    const paymentSource = payload.paymentSource || (method === 'cash' ? 'shift' : 'hand');
    if (amount > 0 && !['cash', 'bank_transfer', 'jazzcash'].includes(method)) {
      return { success: false, statusCode: 400, message: 'Invalid supplier payment method.' };
    }

    const date = payload.date || new Date().toISOString().slice(0, 10);
    const notes = payload.notes?.trim() || null;

    const created = await prisma.$transaction(async (tx) => {
      const openShift = await tx.shift.findFirst({
        where: { status: 'Open' },
        orderBy: { openedAt: 'asc' },
      });

      const isShiftCash = amount > 0 && method === 'cash' && paymentSource === 'shift';

      if (isShiftCash) {
        if (!openShift) {
          throw new Error('No open shift found. Open a shift to pay from shift balance, or choose "Total Cash in Hand (Outside Shift)".');
        }

        const [cashPayments, expenseCashOut, supplierCashOut] = await Promise.all([
          tx.payment.aggregate({
            where: {
              method: 'cash',
              status: { in: ['completed', 'partial'] },
              createdAt: { gte: openShift.openedAt },
            },
            _sum: { amount: true },
          }),
          tx.expensePayment.aggregate({
            where: { shiftId: openShift.id },
            _sum: { amount: true },
          }),
          tx.supplierPayment.aggregate({
            where: { shiftId: openShift.id, method: 'cash' },
            _sum: { amount: true },
          }),
        ]);

        const availableCash = Math.round((
          openShift.openingCash +
          Number(cashPayments._sum.amount || 0) -
          Number(expenseCashOut._sum.amount || 0) -
          Number(supplierCashOut._sum.amount || 0)
        ) * 100) / 100;

        if (amount > availableCash + 1e-9) {
          throw new Error(
            `Insufficient shift cash. Available in shift: Rs. ${availableCash.toLocaleString()}, but supplier payment is Rs. ${amount.toLocaleString()}. You can pay from "Total Cash in Hand (Outside Shift)" instead.`
          );
        }
      }

      const rows = [];
      if (amount > 0) {
        const paymentCloudUuid = clientUuid || crypto.randomUUID();
        const pay = await tx.supplierPayment.create({
          data: {
            supplierId,
            date,
            amount,
            method,
            notes,
            createdById: userId,
            shiftId: isShiftCash ? openShift?.id : null,
            cloudUuid: paymentCloudUuid,
          },
        });
        await SyncQueueService.enqueueCreate(tx, 'SupplierPayment', pay.id, pay, 1);
        rows.push(pay);
      }
      if (discount > 0) {
        const discountNotes = notes
          ? `Discount write-off. ${notes}`
          : 'Discount write-off (balance discarded)';
        const discountCloudUuid = clientUuid ? `${clientUuid}-discount` : crypto.randomUUID();
        const discPay = await tx.supplierPayment.create({
          data: {
            supplierId,
            date,
            amount: discount,
            method: 'discount',
            shiftId: null,
            notes: discountNotes,
            createdById: userId,
            cloudUuid: discountCloudUuid,
          },
        });
        await SyncQueueService.enqueueCreate(tx, 'SupplierPayment', discPay.id, discPay, 1);
        rows.push(discPay);
      }
      return rows;
    });

    return {
      success: true,
      statusCode: 201,
      data: created.length === 1 ? created[0] : created,
    };
  }

  /** Global supplier payment history — which farm was paid, from which shift, how much, on which date */
  static async listPayments(filters: {
    fromDate?: string;
    toDate?: string;
    supplierId?: number;
    shiftId?: number;
    shiftDate?: string;
    method?: string;
  }) {
    const where: any = {};

    if (filters.supplierId && Number.isFinite(filters.supplierId)) {
      where.supplierId = filters.supplierId;
    }

    if (filters.method && filters.method !== 'all') {
      where.method = filters.method;
    }

    if (filters.fromDate || filters.toDate) {
      where.date = {};
      if (filters.fromDate) where.date.gte = filters.fromDate;
      if (filters.toDate) where.date.lte = filters.toDate;
    }

    if (filters.shiftId && Number.isFinite(filters.shiftId)) {
      where.shiftId = filters.shiftId;
    } else if (filters.shiftDate) {
      where.shift = { shiftDate: filters.shiftDate };
    }

    const rows = await prisma.supplierPayment.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        shift: {
          select: {
            id: true,
            shiftDate: true,
            status: true,
            openedAt: true,
            closedAt: true,
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ date: 'desc' }, { id: 'desc' }],
    });

    return rows.map((row) => ({
      id: row.id,
      supplierId: row.supplierId,
      supplierName: row.supplier?.name || '—',
      supplierCode: row.supplier?.code || '',
      date: row.date,
      amount: row.amount,
      method: row.method,
      notes: row.notes,
      createdAt: row.createdAt,
      createdBy: row.createdBy?.name || row.createdBy?.email || null,
      shiftId: row.shiftId,
      shiftDate: row.shift?.shiftDate || null,
      shiftStatus: row.shift?.status || null,
      shiftOpenedAt: row.shift?.openedAt || null,
      shiftClosedAt: row.shift?.closedAt || null,
    }));
  }
}