import { prisma } from '../config/database';

const MOVEMENT_TYPES = ['OPENING', 'STOCK_IN', 'SALE', 'RETURN', 'WASTAGE', 'ADJUSTMENT', 'CONVERSION'];
const money = (value: number) => Math.round(value * 100) / 100;

function rateFor(name: string, rate: { milkRate: number; yogurtRate: number } | null) {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes('milk')) return rate?.milkRate || 0;
  if (normalized.includes('yogurt') || normalized === 'yog') return rate?.yogurtRate || 0;
  return 0;
}

async function averageSupplierCost(name: string) {
  const normalized = name.trim().toLowerCase();
  const costs = normalized.includes('milk')
    ? (await prisma.supplierCollection.findMany({ select: { rate: true }, where: { quantity: { gt: 0 }, rate: { gt: 0 } } })).map((entry) => entry.rate)
    : (await prisma.inventoryMovement.findMany({ where: { movementType: 'STOCK_IN', unitCost: { gt: 0 }, product: { name: { equals: name } } }, select: { unitCost: true } })).map((entry) => entry.unitCost || 0);
  return costs.length ? money(costs.reduce((sum, cost) => sum + cost, 0) / costs.length) : 0;
}

export class InventoryService {
  static async currentRate() {
    return prisma.dailyRate.findFirst({ orderBy: { id: 'desc' }, select: { milkRate: true, yogurtRate: true } });
  }

  static async productView(product: any, movements: any[] = [], rate: any = null) {
    const stock = money(movements.reduce((sum, movement) => sum + movement.quantity, 0));
    const costRows = movements.filter((movement) => movement.unitCost !== null && movement.unitCost > 0);
    const cost = costRows.length ? money(costRows.reduce((sum, movement) => sum + movement.unitCost, 0) / costRows.length) : 0;
    const sellPrice = rateFor(product.name, rate);
    const status = stock <= 0 ? 'Out of Stock' : stock <= product.lowStockThreshold ? 'Warning: Low' : 'In Stock';
    return { ...product, stock, cost, sellPrice, status, tags: [] };
  }

  static async list(search?: string) {
    const products = await prisma.inventoryProduct.findMany({ where: { isActive: true, ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }, { description: { contains: search } }] } : {}) }, orderBy: { name: 'asc' } });
    const rate = await this.currentRate();
    return Promise.all(products.map(async (product) => this.productView(product, await prisma.inventoryMovement.findMany({ where: { productId: product.id }, select: { quantity: true, unitCost: true } }), rate)));
  }

  static async get(id: number) {
    const product = await prisma.inventoryProduct.findUnique({ where: { id } });
    if (!product) return { success: false, statusCode: 404, message: 'Product not found.' };
    const [movements, rate] = await Promise.all([
      prisma.inventoryMovement.findMany({ where: { productId: id }, select: { quantity: true, unitCost: true } }),
      this.currentRate(),
    ]);
    return { success: true, statusCode: 200, data: await this.productView(product, movements, rate) };
  }

  static async summary() {
    const products = await this.list();
    return {
      totalProducts: products.length,
      stockValue: money(products.reduce((sum, product) => sum + product.stock * product.cost, 0)),
      lowStockCount: products.filter((product) => product.status === 'Warning: Low').length,
      outOfStockCount: products.filter((product) => product.status === 'Out of Stock').length,
    };
  }

  static async createProduct(payload: any) {
    if (!payload.code?.trim() || !payload.name?.trim() || !payload.unit?.trim()) return { success: false, statusCode: 400, message: 'Product code, name, and unit are required.' };
    const rate = await this.currentRate();
    if (rateFor(payload.name, rate) <= 0) return { success: false, statusCode: 422, message: 'Selling price is not configured in Daily Rates for this product.' };
    if (await averageSupplierCost(payload.name) <= 0) return { success: false, statusCode: 422, message: 'No supplier cost is available for this product.' };
    try {
      const product = await prisma.inventoryProduct.create({ data: { code: payload.code.trim().toUpperCase(), name: payload.name.trim(), description: payload.description?.trim() || null, category: payload.category?.trim() || 'Dairy', unit: payload.unit.trim(), tax: payload.tax?.trim() || 'Exempt', lowStockThreshold: Number(payload.lowStockThreshold) || 0, isLocked: Boolean(payload.isLocked) } });
      return { success: true, statusCode: 201, data: await this.productView(product, [], rate) };
    } catch (error: any) {
      if (error.code === 'P2002') return { success: false, statusCode: 409, message: 'Product code already exists.' };
      throw error;
    }
  }

  static async pricing(name: string) {
    const rate = await this.currentRate();
    return { sellingPrice: rateFor(name, rate), averageCost: await averageSupplierCost(name) };
  }

  static async updateProduct(id: number, payload: any) {
    const existing = await prisma.inventoryProduct.findUnique({ where: { id } });
    if (!existing) return { success: false, statusCode: 404, message: 'Product not found.' };
    const product = await prisma.inventoryProduct.update({ where: { id }, data: { ...(payload.name !== undefined ? { name: String(payload.name).trim() } : {}), ...(payload.description !== undefined ? { description: payload.description?.trim() || null } : {}), ...(payload.unit !== undefined ? { unit: String(payload.unit).trim() } : {}), ...(payload.tax !== undefined ? { tax: String(payload.tax).trim() } : {}), ...(payload.category !== undefined ? { category: String(payload.category).trim() } : {}), ...(payload.lowStockThreshold !== undefined ? { lowStockThreshold: Number(payload.lowStockThreshold) } : {}), ...(payload.isActive !== undefined ? { isActive: Boolean(payload.isActive) } : {}) } });
    return { success: true, statusCode: 200, data: await this.productView(product, await prisma.inventoryMovement.findMany({ where: { productId: id }, select: { quantity: true, unitCost: true } }), await this.currentRate()) };
  }

  static async deleteProduct(id: number) {
    const product = await prisma.inventoryProduct.findUnique({ where: { id } });
    if (!product) return { success: false, statusCode: 404, message: 'Product not found.' };
    // Core shop items (and all inventory rows) must stay — stock is adjusted, not deleted
    if (product.isLocked) {
      return { success: false, statusCode: 403, message: 'This product is locked and cannot be deleted.' };
    }
    return { success: false, statusCode: 403, message: 'Inventory products cannot be deleted. Adjust stock instead.' };
  }

  static async movements(productId?: number) {
    const movements = await prisma.inventoryMovement.findMany({ where: productId ? { productId } : undefined, orderBy: [{ productId: 'asc' }, { date: 'asc' }, { id: 'asc' }], include: { product: true, supplier: true } });
    const running = new Map<number, number>();
    const withBalances = movements.map((movement) => {
      const previousStock = money(running.get(movement.productId) || 0);
      const newStock = money(previousStock + movement.quantity);
      running.set(movement.productId, newStock);
      return { ...movement, previousStock, newStock };
    });
    return withBalances.sort((a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id);
  }

  static async stockIn(productId?: number) {
    return prisma.inventoryMovement.findMany({ where: { movementType: 'STOCK_IN', ...(productId ? { productId } : {}) }, orderBy: { date: 'desc' }, include: { product: true, supplier: true } });
  }

  static async record(userId: number, payload: any) {
    const productId = Number(payload.productId), quantity = Number(payload.quantity);
    if (!productId || !Number.isFinite(quantity) || quantity === 0 || !MOVEMENT_TYPES.includes(payload.movementType)) return { success: false, statusCode: 400, message: 'Valid product, non-zero quantity, and movement type are required.' };
    const product = await prisma.inventoryProduct.findUnique({ where: { id: productId } });
    if (!product) return { success: false, statusCode: 404, message: 'Product not found.' };
    const existing = await prisma.inventoryMovement.findUnique({ where: { reference: String(payload.reference || '') } });
    if (existing) return { success: true, statusCode: 200, data: existing };
    const current = (await prisma.inventoryMovement.aggregate({ where: { productId }, _sum: { quantity: true } }))._sum.quantity || 0;
    if (current + quantity < 0) return { success: false, statusCode: 422, message: 'Stock cannot become negative.' };
    const movement = await prisma.inventoryMovement.create({ data: { productId, quantity: money(quantity), movementType: payload.movementType, source: payload.source || payload.movementType, reference: String(payload.reference || `inventory-${Date.now()}`), unitCost: payload.unitCost !== undefined ? Number(payload.unitCost) : null, supplierId: payload.supplierId ? Number(payload.supplierId) : null, shiftId: payload.shiftId ? Number(payload.shiftId) : null, userId, date: payload.date ? new Date(payload.date) : new Date() } });
    return { success: true, statusCode: 201, data: movement };
  }
}