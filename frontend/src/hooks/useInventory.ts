import { useState, useEffect, useCallback } from 'react';
import { Product, StockIn, StockMovement, InventorySummary } from '../types/inventory';
import { inventoryService } from '../services/inventoryService';

export const useInventory = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [stockInRecords, setStockInRecords] = useState<StockIn[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [summary, setSummary] = useState<InventorySummary>({
    totalProducts: 0,
    stockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [nextProducts, nextStockIn, nextMovements, nextSummary] = await Promise.all([
        inventoryService.getProducts(),
        inventoryService.getStockInRecords(),
        inventoryService.getMovements(),
        inventoryService.getSummary(),
      ]);
      setProducts(nextProducts);
      setStockInRecords(nextStockIn);
      setMovements(nextMovements);
      setSummary(nextSummary);
    } catch (loadError: any) {
      setError(loadError?.message || 'Failed to load inventory.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addProduct = async (product: Omit<Product, 'id' | 'status'>) => {
    await inventoryService.createProduct(product);
    await loadData();
  };

  const updateProduct = async (id: string, product: Partial<Omit<Product, 'id' | 'stock'>>) => {
    await inventoryService.updateProduct(id, product);
    await loadData();
  };

  const deleteProduct = async (id: string) => {
    await inventoryService.deleteProduct(id);
    await loadData();
  };

  const adjustStock = async (productId: string, type: 'Add Stock' | 'Remove Stock' | 'Set Stock', quantity: number, reason: string, _user: string) => {
    await inventoryService.adjustStock(productId, type, quantity, reason);
    await loadData();
  };

  return {
    products,
    stockInRecords,
    movements,
    summary,
    isLoading,
    error,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    refresh: loadData
  };
};
