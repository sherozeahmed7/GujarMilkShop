import { Product, StockIn, StockMovement, InventorySummary, ProductStatus } from '../types/inventory';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEYS = {
  PRODUCTS: 'inventory_products',
  STOCK_IN: 'inventory_stock_in',
  MOVEMENTS: 'inventory_movements',
};

const initialProducts: Product[] = [
  {
    id: '1', code: 'GHEE', name: 'GHEE', description: 'Desi Ghee', tags: [],
    category: 'Dairy', stock: 50.00, unit: 'kg', sellPrice: 6000, cost: 5500, tax: 'Exempt', status: 'In Stock', isLocked: false, lowStockThreshold: 10
  },
  {
    id: '2', code: 'BUTR', name: 'BUTTER', description: 'Butter', tags: [],
    category: 'Dairy', stock: 50.00, unit: 'kg', sellPrice: 1200, cost: 1000, tax: 'Exempt', status: 'In Stock', isLocked: false, lowStockThreshold: 10
  },
  {
    id: '3', code: 'LASSI', name: 'LASSI', description: 'Lassi', tags: ['FROM MILK'],
    category: 'Beverages', stock: 8.71, unit: 'kg', sellPrice: 70, cost: 50, tax: 'Exempt', status: 'Warning: Low', isLocked: true, lowStockThreshold: 10
  },
  {
    id: '4', code: 'YOGT', name: 'YOG', description: 'Fresh Yogurt', tags: ['FROM MILK'],
    category: 'Dairy', stock: 212.84, unit: 'kg', sellPrice: 270, cost: 190, tax: 'Exempt', status: 'In Stock', isLocked: true, lowStockThreshold: 20
  },
  {
    id: '5', code: 'MILK', name: 'MILK', description: 'Fresh Milk', tags: ['SUPPLIER-FED'],
    category: 'Dairy', stock: 47.75, unit: 'kg', sellPrice: 240, cost: 190.36, tax: 'Exempt', status: 'In Stock', isLocked: true, lowStockThreshold: 15
  }
];

class InventoryService {
  private getStorage<T>(key: string, defaultValue: T): T {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
  }

  private setStorage<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
  }

  // --- Initialize ---
  public initializeMockData(): void {
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
      this.setStorage(STORAGE_KEYS.PRODUCTS, initialProducts);
    }
    if (!localStorage.getItem(STORAGE_KEYS.STOCK_IN)) {
      this.setStorage(STORAGE_KEYS.STOCK_IN, []);
    }
    if (!localStorage.getItem(STORAGE_KEYS.MOVEMENTS)) {
      this.setStorage(STORAGE_KEYS.MOVEMENTS, []);
    }
  }

  // --- Helper ---
  private calculateStatus(stock: number, lowStockThreshold: number): ProductStatus {
    if (stock <= 0) return 'Out of Stock';
    if (stock <= lowStockThreshold) return 'Warning: Low';
    return 'In Stock';
  }

  private recordMovement(movement: Omit<StockMovement, 'id' | 'date'>): void {
    const movements = this.getMovements();
    const newMovement: StockMovement = {
      ...movement,
      id: uuidv4(),
      date: new Date().toISOString(),
    };
    movements.unshift(newMovement); // Add to beginning
    this.setStorage(STORAGE_KEYS.MOVEMENTS, movements);
  }

  // --- Products ---
  public getProducts(): Product[] {
    return this.getStorage<Product[]>(STORAGE_KEYS.PRODUCTS, []);
  }

  public getProductById(id: string): Product | undefined {
    return this.getProducts().find(p => p.id === id);
  }

  public createProduct(productData: Omit<Product, 'id' | 'status'>): Product {
    const products = this.getProducts();
    const newProduct: Product = {
      ...productData,
      id: uuidv4(),
      status: this.calculateStatus(productData.stock, productData.lowStockThreshold)
    };
    products.push(newProduct);
    this.setStorage(STORAGE_KEYS.PRODUCTS, products);

    if (newProduct.stock > 0) {
      this.recordMovement({
        productId: newProduct.id,
        movementType: 'Opening Stock',
        quantity: newProduct.stock,
        previousStock: 0,
        newStock: newProduct.stock,
        reference: 'Initial Setup',
        user: 'System Admin'
      });
    }

    return newProduct;
  }

  public updateProduct(id: string, updates: Partial<Omit<Product, 'id' | 'stock'>>): Product {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Product not found');

    const updatedProduct = {
      ...products[index],
      ...updates,
    };
    
    // Recalculate status in case lowStockThreshold changed
    updatedProduct.status = this.calculateStatus(updatedProduct.stock, updatedProduct.lowStockThreshold);

    products[index] = updatedProduct;
    this.setStorage(STORAGE_KEYS.PRODUCTS, products);
    return updatedProduct;
  }

  public deleteProduct(id: string): void {
    const products = this.getProducts();
    const filtered = products.filter(p => p.id !== id);
    this.setStorage(STORAGE_KEYS.PRODUCTS, filtered);
  }

  // --- Stock In ---
  public getStockInRecords(): StockIn[] {
    return this.getStorage<StockIn[]>(STORAGE_KEYS.STOCK_IN, []);
  }

  public addStockIn(data: Omit<StockIn, 'id' | 'date' | 'totalCost'>): StockIn {
    const products = this.getProducts();
    const productIndex = products.findIndex(p => p.id === data.productId);
    if (productIndex === -1) throw new Error('Product not found');

    const product = products[productIndex];
    const previousStock = product.stock;
    const newStock = previousStock + data.quantity;

    // Update Product
    product.stock = newStock;
    product.status = this.calculateStatus(newStock, product.lowStockThreshold);
    // Optionally update cost average here (ignoring for simple mock unless requested)
    this.setStorage(STORAGE_KEYS.PRODUCTS, products);

    // Create Stock In record
    const stockIn: StockIn = {
      ...data,
      id: uuidv4(),
      date: new Date().toISOString(),
      totalCost: data.quantity * data.unitCost,
    };
    const stockInRecords = this.getStockInRecords();
    stockInRecords.unshift(stockIn);
    this.setStorage(STORAGE_KEYS.STOCK_IN, stockInRecords);

    // Create Movement
    this.recordMovement({
      productId: product.id,
      movementType: 'Stock In',
      quantity: data.quantity,
      previousStock: previousStock,
      newStock: newStock,
      reference: data.reference || `Stock In: ${stockIn.id.slice(0, 8)}`,
      user: data.addedBy,
    });

    return stockIn;
  }

  // --- Stock Adjustment ---
  public adjustStock(productId: string, adjustmentType: 'Add Stock' | 'Remove Stock' | 'Set Stock', quantity: number, reason: string, user: string): void {
    const products = this.getProducts();
    const productIndex = products.findIndex(p => p.id === productId);
    if (productIndex === -1) throw new Error('Product not found');

    const product = products[productIndex];
    const previousStock = product.stock;
    let newStock = previousStock;
    let movementQuantity = 0;

    if (adjustmentType === 'Add Stock') {
      newStock += quantity;
      movementQuantity = quantity;
    } else if (adjustmentType === 'Remove Stock') {
      newStock -= quantity;
      if (newStock < 0) newStock = 0;
      movementQuantity = newStock - previousStock;
    } else if (adjustmentType === 'Set Stock') {
      newStock = quantity;
      movementQuantity = newStock - previousStock;
    }

    product.stock = newStock;
    product.status = this.calculateStatus(newStock, product.lowStockThreshold);
    this.setStorage(STORAGE_KEYS.PRODUCTS, products);

    this.recordMovement({
      productId: product.id,
      movementType: 'Adjustment',
      quantity: movementQuantity,
      previousStock: previousStock,
      newStock: newStock,
      reference: reason,
      user: user,
      notes: reason,
    });
  }

  // --- Movements ---
  public getMovements(): StockMovement[] {
    return this.getStorage<StockMovement[]>(STORAGE_KEYS.MOVEMENTS, []);
  }

  // --- Summary ---
  public getSummary(): InventorySummary {
    const products = this.getProducts();
    return {
      totalProducts: products.length,
      stockValue: products.reduce((acc, p) => acc + (p.stock * p.cost), 0),
      lowStockCount: products.filter(p => p.status === 'Warning: Low').length,
      outOfStockCount: products.filter(p => p.status === 'Out of Stock').length,
    };
  }
}

export const inventoryService = new InventoryService();
