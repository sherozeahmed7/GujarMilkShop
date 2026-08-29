import React, { useMemo, useState } from 'react';
import { Package, ShoppingCart, Activity, Plus, Milk } from 'lucide-react';
import { MilkProducts } from './inventory/MilkProducts';
import { useInventory } from '../hooks/useInventory';
import { InventorySummaryCards } from '../components/inventory/InventorySummaryCards';
import { ProductsTab } from '../components/inventory/ProductsTab';
import { StockInTab } from '../components/inventory/StockInTab';
import { StockMovementsTab } from '../components/inventory/StockMovementsTab';
import { AddProductModal } from '../components/inventory/AddProductModal';
import { EditProductModal } from '../components/inventory/EditProductModal';
import { StockAdjustmentModal } from '../components/inventory/StockAdjustmentModal';
import { DeleteConfirmModal } from '../components/inventory/DeleteConfirmModal';
import { ExportButtons } from '../components/reports/ExportButtons';
import { AssignMilkToYogurtModal } from '../components/inventory/AssignMilkToYogurtModal';
import { Product } from '../types/inventory';

export const Inventory: React.FC = () => {
  const {
    products,
    stockInRecords,
    movements,
    summary,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    isLoading,
    error,
    refresh,
  } = useInventory();

  const [activeTab, setActiveTab] = useState('Products');
  const [showToast, setShowToast] = useState('');

  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showMilkToYogurt, setShowMilkToYogurt] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [adjustingStockProduct, setAdjustingStockProduct] = useState<Product | null>(null);

  const handleAction = (message: string) => {
    setShowToast(message);
    setTimeout(() => setShowToast(''), 3000);
  };

  const exportConfig = useMemo(() => {
    if (activeTab === 'Stock In') {
      return {
        reportName: 'Stock_In',
        columns: [
          { header: 'Date', dataKey: 'date' },
          { header: 'Product', dataKey: 'productName' },
          { header: 'Quantity', dataKey: 'quantity' },
          { header: 'Unit Cost', dataKey: 'unitCost' },
          { header: 'Source', dataKey: 'source' },
        ],
        data: stockInRecords.map((r: any) => ({
          date: r.date || r.createdAt || '',
          productName: r.productName || r.product?.name || '',
          quantity: r.quantity,
          unitCost: r.unitCost ?? '',
          source: r.source || '',
        })),
      };
    }
    if (activeTab === 'Stock Movements') {
      return {
        reportName: 'Stock_Movements',
        columns: [
          { header: 'Date', dataKey: 'date' },
          { header: 'Product', dataKey: 'productName' },
          { header: 'Type', dataKey: 'movementType' },
          { header: 'Quantity', dataKey: 'quantity' },
          { header: 'Reference', dataKey: 'reference' },
        ],
        data: movements.map((m: any) => ({
          date: m.date || m.createdAt || '',
          productName: m.productName || m.product?.name || '',
          movementType: m.movementType || m.type || '',
          quantity: m.quantity,
          reference: m.reference || '',
        })),
      };
    }
    return {
      reportName: 'Products',
      columns: [
        { header: 'Name', dataKey: 'name' },
        { header: 'Code', dataKey: 'code' },
        { header: 'Stock', dataKey: 'stock' },
        { header: 'Cost', dataKey: 'cost' },
        { header: 'Sell Price', dataKey: 'sellPrice' },
        { header: 'Status', dataKey: 'status' },
      ],
      data: products.map((p) => ({
        name: p.name,
        code: p.code,
        stock: p.stock,
        cost: p.cost,
        sellPrice: p.sellPrice,
        status: p.status,
      })),
    };
  }, [activeTab, products, stockInRecords, movements]);

  return (
    <div className="flex flex-col gap-6 relative h-full">
      {showToast && (
        <div className="absolute top-0 right-0 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in text-sm font-medium">
          {showToast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory Management</h1>
          <p className="text-slate-500 text-sm mt-1">Track product levels, valuation, and refill status.</p>
        </div>
        <div className="flex items-center gap-3">
          <ExportButtons
            reportName={exportConfig.reportName}
            data={exportConfig.data}
            columns={exportConfig.columns}
            summaryData={{
              totalProducts: summary.totalProducts,
              stockValue: summary.stockValue,
              lowStock: summary.lowStockCount,
              outOfStock: summary.outOfStockCount,
            }}
          />
          <button onClick={() => setShowMilkToYogurt(true)} className="flex items-center gap-2 px-3 py-2 bg-white border border-blue-200 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors shadow-sm">
            Milk → Yogurt
          </button>
          <button onClick={() => setShowAddProduct(true)} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 rounded-lg text-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      <InventorySummaryCards summary={summary} />
      {isLoading && <div className="text-xs font-medium text-slate-400">Loading inventory...</div>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden min-h-[500px]">
        <div className="flex items-center gap-6 border-b border-slate-200 px-2 pt-2 bg-slate-50/50">
          {['Products', 'Stock In', 'Stock Movements', 'F2 Items'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab === 'Products' && <Package className="w-4 h-4" />}
              {tab === 'Stock In' && <ShoppingCart className="w-4 h-4" />}
              {tab === 'Stock Movements' && <Activity className="w-4 h-4" />}
              {tab === 'F2 Items' && <Milk className="w-4 h-4" />}
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Products' && (
          <ProductsTab
            products={products}
            onAddStockClick={(id) => {
              const product = products.find(p => p.id === id);
              if (product) setAdjustingStockProduct(product);
            }}
            onEditClick={(product) => setEditingProduct(product)}
            onDeleteClick={(product) => setDeletingProduct(product)}
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

        {activeTab === 'F2 Items' && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <MilkProducts />
          </div>
        )}
      </div>

      {showMilkToYogurt && (
        <AssignMilkToYogurtModal
          onClose={() => setShowMilkToYogurt(false)}
          onDone={() => {
            refresh();
            handleAction('Milk assigned to yogurt');
          }}
        />
      )}

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

      {deletingProduct && (
        <DeleteConfirmModal
          title="Delete Product"
          message={`Are you sure you want to delete ${deletingProduct.name}? This action cannot be undone.`}
          onClose={() => setDeletingProduct(null)}
          onConfirm={() => {
            deleteProduct(deletingProduct.id).then(() => handleAction('Product deleted successfully')).catch(() => undefined);
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
