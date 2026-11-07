export type ProductStatus = 'In Stock' | 'Warning: Low' | 'Out of Stock';

export interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  tags: string[];
  category: string;
  stock: number;
  unit: string;
  sellPrice: number;
  cost: number;
  tax: string;
  status: ProductStatus;
  isLocked: boolean;
  lowStockThreshold: number;
  /** false when soft-deleted from Inventory; active cards must check this */
  isActive?: boolean;
}

export interface StockIn {
  id: string;
  date: string; // ISO string
  reference: string;
  productId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier: string;
  addedBy: string;
}

export type MovementType = 'Opening Stock' | 'Stock In' | 'Sale' | 'Return' | 'Adjustment' | 'Conversion';

export interface StockMovement {
  id: string;
  date: string; // ISO string
  productId: string;
  movementType: MovementType;
  quantity: number; // positive for added stock, negative for removed
  previousStock: number;
  newStock: number;
  reference: string;
  user: string;
  notes?: string;
}

export interface InventorySummary {
  totalProducts: number;
  stockValue: number;
  lowStockCount: number;
  outOfStockCount: number;
}
