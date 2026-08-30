import { prisma } from '../config/database';
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
    id: String(supplier.id), name: supplier.name, code: supplier.code, phone: supplier.phone || '',
    defaultRate: supplier.defaultRate, cowRate: supplier.cowRate, buffaloRate: supplier.buffaloRate,
    cycleType: supplier.cycleType, isActive: supplier.isActive, guaranteedAdvance: advance,
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

export class SupplierService {
  static async list(filters?: {
    cycleType?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const where: any = {};
    if (filters?.cycleType && CYCLE_TYPES.includes(filters.cycleType)) {
      where.cycleType = filters.cycleType;
    }

    let suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { id: 'desc' },
      include: { collections: true, payments: true },
    });

    let rangeStart: string | null = null;
    let rangeEnd: string | null = null;
    if (filters?.fromDate) {
      const d = new Date(filters.fromDate);
      if (!Number.isNaN(d.getTime())) rangeStart = localDateKey(d);
    }
    if (filters?.toDate) {
      const d = new Date(filters.toDate);
      if (!Number.isNaN(d.getTime())) rangeEnd = localDateKey(d);
    }

    if (rangeStart || rangeEnd) {
      suppliers = suppliers.filter((s) =>
        s.collections.some((c) => {
          const date = String(c.date);
          if (rangeStart && date < rangeStart) return false;
          if (rangeEnd && date > rangeEnd) return false;
          return true;
        })
      );
    }

    return suppliers.map((s) => shape(s, s.collections, s.payments, rangeStart, rangeEnd));
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
    if (!payload.name?.trim() || !payload.code?.trim()) return { success: false, statusCode: 400, message: 'Name and code are required.' };
    if (!CYCLE_TYPES.includes(payload.cycleType)) return { success: false, statusCode: 400, message: 'Invalid cycle type.' };
    try {
      const supplier = await prisma.$transaction(async (tx) => {
        const created = await tx.supplier.create({ data: {
          name: payload.name.trim(), code: payload.code.trim(), phone: payload.phone?.trim() || null,
          defaultRate: Number(payload.defaultRate) || 0, cowRate: Number(payload.cowRate) || 0,
          buffaloRate: Number(payload.buffaloRate) || 0, cycleType: payload.cycleType,
          isActive: payload.isActive !== false, guaranteedAdvance: Number(payload.guaranteedAdvance) || 0,
        }});
        await SyncQueueService.enqueueCreate(tx, 'Supplier', created.id, created, 0);
        return created;
      });
      return { success: true, statusCode: 201, data: shape(supplier) };
    } catch (error: any) {
      if (error.code === 'P2002') return { success: false, statusCode: 409, message: 'Supplier code already exists.' };
      throw error;
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
      prisma.supplierPayment.findMany({ where: { supplierId }, orderBy: { date: 'desc' } }),
    ]);
    return { success: true, statusCode: 200, data: { collections, payments } };
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
    if (amount > 0 && !['cash', 'bank_transfer', 'jazzcash'].includes(method)) {
      return { success: false, statusCode: 400, message: 'Invalid supplier payment method.' };
    }

    const date = payload.date || new Date().toISOString().slice(0, 10);
    const notes = payload.notes?.trim() || null;

    const created = await prisma.$transaction(async (tx) => {
      const rows = [];
      if (amount > 0) {
        const pay = await tx.supplierPayment.create({
          data: { supplierId, date, amount, method, notes, createdById: userId },
        });
        await SyncQueueService.enqueueCreate(tx, 'SupplierPayment', pay.id, pay, 1);
        rows.push(pay);
      }
      if (discount > 0) {
        const discountNotes = notes
          ? `Discount write-off. ${notes}`
          : 'Discount write-off (balance discarded)';
        const discPay = await tx.supplierPayment.create({
          data: {
            supplierId,
            date,
            amount: discount,
            method: 'discount',
            notes: discountNotes,
            createdById: userId,
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
}