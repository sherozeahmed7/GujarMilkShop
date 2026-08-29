import { apiClient } from './apiClient';
import { Product, StockIn, StockMovement, InventorySummary } from '../types/inventory';

const mapProduct = (product: any): Product => ({
  ...product,
  id: String(product.id),
  description: product.description || '',
  tags: product.tags || [],
  stock: Number(product.stock || 0),
  sellPrice: Number(product.sellPrice || 0),
  cost: Number(product.cost || 0),
  lowStockThreshold: Number(product.lowStockThreshold || 0),
});

const mapMovement = (movement: any): StockMovement => ({
  ...movement,
  id: String(movement.id),
  productId: String(movement.productId),
  date: new Date(movement.date).toISOString(),
  movementType: movement.movementType === 'STOCK_IN' ? 'Stock In'
    : movement.movementType === 'SALE' ? 'Sale'
    : movement.movementType === 'RETURN' ? 'Return'
    : movement.movementType === 'WASTAGE' ? 'Wastage'
    : movement.movementType === 'CONVERSION' ? 'Conversion'
    : movement.movementType === 'OPENING' ? 'Opening'
    : movement.movementType === 'ADJUSTMENT' ? 'Adjustment'
    : movement.movementType || 'Adjustment',
  quantity: Number(movement.quantity),
  previousStock: Number(movement.previousStock || 0),
  newStock: Number(movement.newStock || 0),
  reference: movement.reference,
  user: movement.user?.name || movement.user?.email || 'System',
  notes: movement.notes || movement.source,
});

const mapStockIn = (movement: any): StockIn => ({
  id: String(movement.id),
  date: new Date(movement.date).toISOString(),
  reference: movement.reference,
  productId: String(movement.productId),
  quantity: Number(movement.quantity),
  unitCost: Number(movement.unitCost || 0),
  totalCost: Number(movement.quantity || 0) * Number(movement.unitCost || 0),
  supplier: movement.supplier?.name || movement.source || 'Unknown',
  addedBy: movement.user?.name || movement.user?.email || 'System',
});

export const inventoryService = {
  async initializeMockData(): Promise<void> {},
  async getPricing(name: string): Promise<{ sellingPrice: number; averageCost: number }> {
    const response = await apiClient.get('/inventory/pricing', { name });
    return response.data as { sellingPrice: number; averageCost: number };
  },
  async getProducts(search?: string): Promise<Product[]> {
    const response = await apiClient.get('/inventory', search ? { search } : undefined);
    return (response.data || []).map(mapProduct);
  },
  async getProductById(id: string): Promise<Product | undefined> {
    try { const response = await apiClient.get(`/inventory/${id}`); return mapProduct(response.data); } catch { return undefined; }
  },
  async createProduct(product: Omit<Product, 'id' | 'status'>): Promise<Product> {
    const response = await apiClient.post('/inventory', product);
    return mapProduct(response.data);
  },
  async updateProduct(id: string, updates: Partial<Omit<Product, 'id' | 'stock'>>): Promise<Product> {
    const response = await apiClient.put(`/inventory/${id}`, updates);
    return mapProduct(response.data);
  },
  async deleteProduct(id: string): Promise<void> { await apiClient.delete(`/inventory/${id}`); },
  async getStockInRecords(): Promise<StockIn[]> {
    const response = await apiClient.get('/inventory/stock-in');
    return (response.data || []).map(mapStockIn);
  },
  async getMovements(): Promise<StockMovement[]> {
    const response = await apiClient.get('/inventory/movements');
    return (response.data || []).map(mapMovement);
  },
  async getSummary(): Promise<InventorySummary> {
    const response = await apiClient.get('/inventory/summary');
    return response.data as InventorySummary;
  },
  async adjustStock(productId: string, type: 'Add Stock' | 'Remove Stock' | 'Set Stock', quantity: number, reason: string): Promise<void> {
    const product = await this.getProductById(productId);
    if (!product) throw new Error('Product not found.');
    const delta = type === 'Add Stock' ? quantity : type === 'Remove Stock' ? -quantity : quantity - product.stock;
    if (!Number.isFinite(delta) || delta === 0) throw new Error('Stock adjustment must change stock by a non-zero amount.');
    await apiClient.post('/inventory/movements', { productId: Number(productId), quantity: delta, movementType: 'ADJUSTMENT', source: 'Manual Adjustment', reference: `adjustment-${productId}-${Date.now()}`, notes: reason });
  },
  async assignMilkToYogurt(milkQty: number, yogurtQty?: number): Promise<{ milkQty: number; yogurtQty: number }> {
    const response = await apiClient.post('/inventory/assign-milk-to-yogurt', {
      milkQty,
      yogurtQty: yogurtQty ?? milkQty,
    });
    return response.data as { milkQty: number; yogurtQty: number };
  },
};
