import React, { useState } from 'react';
import { Package, ShoppingCart, Activity, Download, FileText, Plus } from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { InventorySummaryCards } from '../components/inventory/InventorySummaryCards';
import { ProductsTab } from '../components/inventory/ProductsTab';
import { StockInTab } from '../components/inventory/StockInTab';
import { StockMovementsTab } from '../components/inventory/StockMovementsTab';
import { AddProductModal } from '../components/inventory/AddProductModal';
import { EditProductModal } from '../components/inventory/EditProductModal';
import { StockAdjustmentModal } from '../components/inventory/StockAdjustmentModal';
import { DeleteConfirmModal } from '../components/inventory/DeleteConfirmModal';
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
    adjustStock
  } = useInventory();

  const [activeTab, setActiveTab] = useState('Products');
  const [showToast, setShowToast] = useState('');

  // Modals state
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
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
          <h1 className="text-2xl font-bold text-slate-800">Inventory Management</h1>
          <p className="text-slate-500 text-sm mt-1">Track product levels, valuation, and refill status.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => handleAction('Exporting Excel...')} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            <Download className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => handleAction('Generating PDF...')} className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            <FileText className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => setShowAddProduct(true)} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 rounded-lg text-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <InventorySummaryCards summary={summary} />

      {/* Main Content Area */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden min-h-[500px]">
        
        {/* Tabs */}
        <div className="flex items-center gap-6 border-b border-slate-200 px-2 pt-2 bg-slate-50/50">
          {['Products', 'Stock In', 'Stock Movements'].map(tab => (
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

      </div>

      {/* Modals */}
      {showAddProduct && (
        <AddProductModal 
          onClose={() => setShowAddProduct(false)} 
          onSave={(data) => {
            addProduct(data);
            handleAction('Product added successfully');
          }} 
        />
      )}

      {editingProduct && (
        <EditProductModal 
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSave={(id, updates) => {
            updateProduct(id, updates);
            handleAction('Product updated successfully');
          }}
        />
      )}

      {deletingProduct && (
        <DeleteConfirmModal
          title="Delete Product"
          message={`Are you sure you want to delete ${deletingProduct.name}? This action cannot be undone.`}
          onClose={() => setDeletingProduct(null)}
          onConfirm={() => {
            deleteProduct(deletingProduct.id);
            handleAction('Product deleted successfully');
          }}
        />
      )}

      {adjustingStockProduct && (
        <StockAdjustmentModal 
          product={adjustingStockProduct}
          onClose={() => setAdjustingStockProduct(null)}
          onSave={(id, type, qty, reason, user) => {
            adjustStock(id, type, qty, reason, user);
            handleAction('Stock adjusted successfully');
          }}
        />
      )}

    </div>
  );
};
