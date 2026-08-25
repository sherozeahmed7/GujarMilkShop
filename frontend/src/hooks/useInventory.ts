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

  const loadData = useCallback(() => {
    setProducts(inventoryService.getProducts());
    setStockInRecords(inventoryService.getStockInRecords());
    setMovements(inventoryService.getMovements());
    setSummary(inventoryService.getSummary());
  }, []);

  useEffect(() => {
    inventoryService.initializeMockData();
    loadData();
  }, [loadData]);

  const addProduct = (product: Omit<Product, 'id' | 'status'>) => {
    inventoryService.createProduct(product);
    loadData();
  };

  const updateProduct = (id: string, product: Partial<Omit<Product, 'id' | 'stock'>>) => {
    inventoryService.updateProduct(id, product);
    loadData();
  };

  const deleteProduct = (id: string) => {
    inventoryService.deleteProduct(id);
    loadData();
  };

  const addStockIn = (data: Omit<StockIn, 'id' | 'date' | 'totalCost'>) => {
    inventoryService.addStockIn(data);
    loadData();
  };

  const adjustStock = (productId: string, type: 'Add Stock' | 'Remove Stock' | 'Set Stock', quantity: number, reason: string, user: string) => {
    inventoryService.adjustStock(productId, type, quantity, reason, user);
    loadData();
  };

  return {
    products,
    stockInRecords,
    movements,
    summary,
    addProduct,
    updateProduct,
    deleteProduct,
    addStockIn,
    adjustStock,
    refresh: loadData
  };
};
