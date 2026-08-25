import { prisma } from '../config/database';

const CYCLE_TYPES = ['Monthly Cycle', '1-Day Cycle', 'Weekly Cycle'];
const SHIFTS = ['Morning', 'Evening'];
const MILK_TYPES = ['Mixed', 'Cow', 'Buffalo'];
const money = (value: number) => Math.round(value * 100) / 100;

function shape(supplier: any, collections: any[] = [], payments: any[] = []) {
  const purchased = collections.reduce((sum, item) => sum + item.amount, 0);
  const paid = payments.reduce((sum, item) => sum + item.amount, 0);
  return {
    id: String(supplier.id), name: supplier.name, code: supplier.code, phone: supplier.phone || '',
    defaultRate: supplier.defaultRate, cowRate: supplier.cowRate, buffaloRate: supplier.buffaloRate,
    cycleType: supplier.cycleType, isActive: supplier.isActive, guaranteedAdvance: supplier.guaranteedAdvance,
    payableBalance: money(purchased - paid),
  };
}

export class SupplierService {
  static async list() {
    const suppliers = await prisma.supplier.findMany({
      orderBy: { id: 'desc' },
      include: { collections: true, payments: true },
    });
    return suppliers.map((s) => shape(s, s.collections, s.payments));
  }

  static async create(payload: any) {
    if (!payload.name?.trim() || !payload.code?.trim()) return { success: false, statusCode: 400, message: 'Name and code are required.' };
    if (!CYCLE_TYPES.includes(payload.cycleType)) return { success: false, statusCode: 400, message: 'Invalid cycle type.' };
    try {
      const supplier = await prisma.supplier.create({ data: {
        name: payload.name.trim(), code: payload.code.trim(), phone: payload.phone?.trim() || null,
        defaultRate: Number(payload.defaultRate) || 0, cowRate: Number(payload.cowRate) || 0,
        buffaloRate: Number(payload.buffaloRate) || 0, cycleType: payload.cycleType,
        isActive: payload.isActive !== false, guaranteedAdvance: Number(payload.guaranteedAdvance) || 0,
      }});
      return { success: true, statusCode: 201, data: shape(supplier) };
    } catch (error: any) {
      if (error.code === 'P2002') return { success: false, statusCode: 409, message: 'Supplier code already exists.' };
      throw error;
    }
  }

  static async update(id: number, payload: any) {
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) return { success: false, statusCode: 404, message: 'Supplier not found.' };
    const supplier = await prisma.supplier.update({ where: { id }, data: {
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
        const product = await tx.inventoryProduct.findFirst({ where: { code: 'MILK' } });
        const shift = await tx.shift.findFirst({ where: { status: 'Open' }, orderBy: { openedAt: 'asc' } });
        if (product) {
          await tx.inventoryMovement.upsert({
            where: { reference: `supplier-collection-${saved.id}` },
            create: { productId: product.id, quantity, movementType: 'STOCK_IN', source: 'Supplier Purchase', reference: `supplier-collection-${saved.id}`, unitCost: rate, supplierId, userId, shiftId: shift?.id, date: new Date(`${payload.date}T00:00:00`) },
            update: { productId: product.id, quantity, unitCost: rate, supplierId, userId, shiftId: shift?.id, date: new Date(`${payload.date}T00:00:00`) },
          });
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
      await tx.supplierCollection.delete({ where: { id } });
      await tx.inventoryMovement.deleteMany({ where: { reference: `supplier-collection-${id}` } });
    });
    return { success: true, statusCode: 200, data: null };
  }

  static async addPayment(userId: number, supplierId: number, payload: any) {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, statusCode: 400, message: 'Payment amount must be greater than zero.' };
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId }, include: { collections: true, payments: true } });
    if (!supplier) return { success: false, statusCode: 404, message: 'Supplier not found.' };
    const balance = money(supplier.collections.reduce((s, c) => s + c.amount, 0) - supplier.payments.reduce((s, p) => s + p.amount, 0));
    if (amount > balance) return { success: false, statusCode: 400, message: `Payment cannot exceed payable balance of Rs. ${balance}.` };
    const method = payload.method || 'cash';
    if (!['cash', 'bank_transfer', 'jazzcash'].includes(method)) return { success: false, statusCode: 400, message: 'Invalid supplier payment method.' };
    const payment = await prisma.supplierPayment.create({ data: { supplierId, date: payload.date || new Date().toISOString().slice(0, 10), amount, method, notes: payload.notes?.trim() || null, createdById: userId } });
    return { success: true, statusCode: 201, data: payment };
  }
}