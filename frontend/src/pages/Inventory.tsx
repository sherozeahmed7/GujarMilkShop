import React, { useState } from 'react';
import { Package, ShoppingCart, Activity, Plus } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventorySummaryCards } from '../components/inventory/InventorySummaryCards';
import { ProductsTab } from '../components/inventory/ProductsTab';
import { StockInTab } from '../components/inventory/StockInTab';
import { StockMovementsTab } from '../components/inventory/StockMovementsTab';
import { AddProductModal } from '../components/inventory/AddProductModal';
import { EditProductModal } from '../components/inventory/EditProductModal';
import { StockAdjustmentModal } from '../components/inventory/StockAdjustmentModal';
import { ExportButtons } from '../components/reports/ExportButtons';
import { Product } from '../types/inventory';

export const Inventory: React.FC = () => {
  const {
    products,
    stockInRecords,
    movements,
    summary,
    addProduct,
    updateProduct,
    adjustStock,
    isLoading,
    error,
    loadMovements
  } = useInventory();

  const [activeTab, setActiveTab] = useState('Products');
  const movementsLoadedRef = React.useRef(false);

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Lazy-load movements only when the user first opens that tab
    if (tab === 'Stock Movements' && !movementsLoadedRef.current) {
      movementsLoadedRef.current = true;
      loadMovements();
    }
    if (tab === 'Stock In' && stockInRecords.length === 0) {
      // stockIn already loaded eagerly, nothing to do
    }
  };
  const [showToast, setShowToast] = useState('');

  // Modals state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingStockProduct, setAdjustingStockProduct] = useState<Product | null>(null);

  const handleAction = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(''), 3000);
  };

  return (
    <div className="flex flex-col gap-6 relative h-full">
      {/* Toast Notification */}
      {showToast && (
        <div className="absolute top-0 right-0 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in text-sm font-medium">
          {showToast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8]">Inventory Management</h1>
          <p className="text-slate-500 dark:text-[#64916e] text-sm mt-1">Track product levels, valuation, and refill status.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons
            reportName="Inventory"
            data={products.map((product) => ({
              ...product,
              inventoryValue: product.stock * product.cost,
            }))}
            columns={[
              { header: 'Code', dataKey: 'code' },
              { header: 'Product', dataKey: 'name' },
              { header: 'Category', dataKey: 'category' },
              { header: 'Stock', dataKey: 'stock' },
              { header: 'Unit', dataKey: 'unit' },
              { header: 'Cost', dataKey: 'cost' },
              { header: 'Selling Price', dataKey: 'sellPrice' },
              { header: 'Inventory Value', dataKey: 'inventoryValue' },
              { header: 'Status', dataKey: 'status' },
            ]}
            summaryData={{
              products: summary.totalProducts,
              stockValue: `Rs. ${summary.stockValue.toLocaleString()}`,
              lowStock: summary.lowStockCount,
              outOfStock: summary.outOfStockCount,
            }}
          />
          <button onClick={() => setShowAddProduct(true)} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 rounded-lg text-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <InventorySummaryCards summary={summary} />
      {isLoading && <div className="text-xs font-medium text-slate-400">Loading inventory...</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      {/* Main Content Area */}
      <div className="bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden min-h-[500px]">
        
        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-slate-200 dark:border-[#2d4a35] px-2 pt-2 bg-slate-50/50 dark:bg-[#142119]/50">
          {['Products', 'Stock In', 'Stock Movements'].map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab 
                  ? 'border-blue-600 text-blue-700 dark:border-[#22c55e] dark:text-[#22c55e]' 
                  : 'border-transparent text-slate-500 dark:text-[#64916e] hover:text-slate-700 dark:hover:text-[#a7c4ae] hover:border-slate-300 dark:hover:border-[#2d4a35]'
              }`}
            >
              {tab === 'Products' && <Package className="w-4 h-4" />}
              {tab === 'Stock In' && <ShoppingCart className="w-4 h-4" />}
              {tab === 'Stock Movements' && <Activity className="w-4 h-4" />}
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'Products' && (
          <ProductsTab 
            products={products}
            onAddStockClick={(id) => {
              const product = products.find(p => p.id === id);
              if (product) setAdjustingStockProduct(product);
            }}
            onEditClick={(product) => setEditingProduct(product)}
          />
        )}
        
        {activeTab === 'Stock In' && (
          <StockInTab 
            stockInRecords={stockInRecords}
            products={products}
          />
        )}
        
        {activeTab === 'Stock Movements' && (
          <StockMovementsTab 
            movements={movements}
            products={products}
          />
        )}

      </div>

      {/* Modals */}
      {showAddProduct && (
        <AddProductModal 
          onClose={() => setShowAddProduct(false)} 
          onSave={(data) => {
            return addProduct(data).then(() => handleAction('Product added successfully'));
          }} 
        />
      )}

      {editingProduct && (
        <EditProductModal 
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={(id, updates) => {
            updateProduct(id, updates).then(() => handleAction('Product updated successfully')).catch(() => undefined);
          }}
        />
      )}

      {adjustingStockProduct && (
        <StockAdjustmentModal 
          product={adjustingStockProduct}
          onClose={() => setAdjustingStockProduct(null)}
          onSave={(id, type, qty, reason, user) => {
            adjustStock(id, type, qty, reason, user).then(() => handleAction('Stock adjusted successfully')).catch(() => undefined);
          }}
        />
      )}

    </div>
  );
};
