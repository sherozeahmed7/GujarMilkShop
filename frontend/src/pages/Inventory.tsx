import React, { useState } from 'react';
import { 
  Package, TrendingUp, AlertTriangle, AlertCircle, Search, 
  Download, Plus, Filter, FileText, PlusCircle, Edit2, Trash2, 
  Lock, ShoppingCart, Activity, X
} from 'lucide-react';

interface Product {
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
  status: 'In Stock' | 'Warning: Low' | 'Out of Stock';
  isLocked: boolean;
}

const initialProducts: Product[] = [
  {
    id: '1', code: 'GHEE', name: 'GHEE', description: 'Desi Ghee', tags: [],
    category: 'Dairy', stock: 50.00, unit: 'kg', sellPrice: 6000, cost: 5500, tax: 'Exempt', status: 'In Stock', isLocked: false
  },
  {
    id: '2', code: 'BUTR', name: 'BUTTER', description: 'Butter', tags: [],
    category: 'Dairy', stock: 50.00, unit: 'kg', sellPrice: 1200, cost: 1000, tax: 'Exempt', status: 'In Stock', isLocked: false
  },
  {
    id: '3', code: 'LASSI', name: 'LASSI', description: 'Lassi', tags: ['FROM MILK'],
    category: 'Beverages', stock: 8.71, unit: 'kg', sellPrice: 70, cost: 50, tax: 'Exempt', status: 'Warning: Low', isLocked: true
  },
  {
    id: '4', code: 'YOGT', name: 'YOG', description: 'Fresh Yogurt', tags: ['FROM MILK'],
    category: 'Dairy', stock: 212.84, unit: 'kg', sellPrice: 270, cost: 190, tax: 'Exempt', status: 'In Stock', isLocked: true
  },
  {
    id: '5', code: 'MILK', name: 'MILK', description: 'Fresh Milk', tags: ['SUPPLIER-FED'],
    category: 'Dairy', stock: 47.75, unit: 'kg', sellPrice: 240, cost: 190.36, tax: 'Exempt', status: 'In Stock', isLocked: true
  }
];

export const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [activeTab, setActiveTab] = useState('Products');
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [showToast, setShowToast] = useState('');

  // Summary Metrics
  const totalProducts = products.length;
  const stockValue = products.reduce((acc, p) => acc + (p.stock * p.cost), 0);
  const lowStockCount = products.filter(p => p.status === 'Warning: Low').length;
  const outOfStockCount = products.filter(p => p.status === 'Out of Stock').length;

  const handleAction = (action: string) => {
    setShowToast(action);
    setTimeout(() => setShowToast(''), 3000);
  };

  const handleStockAdd = (id: string) => {
    setProducts(products.map(p => {
      if (p.id === id) {
        const newStock = p.stock + 10;
        return { ...p, stock: newStock, status: newStock > 10 ? 'In Stock' : p.status };
      }
      return p;
    }));
    handleAction('Stock updated');
  };

  const handleDelete = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
    handleAction('Product deleted');
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = (p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           p.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    const matchesStatus = statusFilter === 'All Status' || p.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const formatCurrency = (n: number) => `Rs. ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

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
          <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-3 py-2 bg-emerald-600 rounded-lg text-sm font-medium text-white hover:bg-emerald-700 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /> Add Product
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
            <Package className="w-4 h-4 text-slate-400" /> Products
          </div>
          <div className="text-2xl font-bold text-slate-800">{totalProducts}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> Stock Value
          </div>
          <div className="text-2xl font-bold text-slate-800">{formatCurrency(stockValue)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
            <Filter className="w-4 h-4 text-amber-500" /> Low Stock
          </div>
          <div className="text-2xl font-bold text-slate-800">{lowStockCount}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
          <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-wider">
            <Package className="w-4 h-4 text-rose-500" /> Out of Stock
          </div>
          <div className="text-2xl font-bold text-slate-800">{outOfStockCount}</div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col flex-1 overflow-hidden">
        
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

        {/* Filters */}
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 bg-white">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow" 
              placeholder="Search by name or code..." 
            />
          </div>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:w-40"
          >
            <option value="ALL">ALL CATEGORIES</option>
            <option value="Dairy">Dairy</option>
            <option value="Beverages">Beverages</option>
          </select>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 sm:w-40"
          >
            <option value="All Status">All Status</option>
            <option value="In Stock">In Stock</option>
            <option value="Warning: Low">Warning: Low</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm border-b border-slate-200">
              <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3">Sell Price</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Tax</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{product.code}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{product.name}</span>
                      <span className="text-sm text-slate-500">{product.description}</span>
                      {product.tags.map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 uppercase tracking-wider">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600">{product.category}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-800">
                    {product.stock.toFixed(2)} {product.unit}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-700">{formatCurrency(product.sellPrice)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-500">{formatCurrency(product.cost)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 text-xs font-semibold rounded bg-slate-100 text-slate-600">
                      {product.tax}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-full ${
                      product.status === 'In Stock' ? 'bg-emerald-100 text-emerald-700' :
                      product.status === 'Warning: Low' ? 'bg-amber-100 text-amber-700' :
                      'bg-rose-100 text-rose-700'
                    }`}>
                      {product.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleStockAdd(product.id)} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Add Stock">
                        <PlusCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleAction('Edit product clicked')} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {product.isLocked ? (
                        <button onClick={() => handleAction('Product is locked')} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded cursor-not-allowed" title="Locked">
                          <Lock className="w-4 h-4" />
                        </button>
                      ) : (
                        <button onClick={() => handleDelete(product.id)} className="p-1.5 text-rose-500 hover:bg-rose-50 rounded" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500 text-sm">
                    No products found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal (Simplified) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Add New Product</h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <p className="text-sm text-slate-500 mb-4">This is a mockup modal. Connecting to the database will be implemented later.</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                  <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Fresh Milk" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
                    <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. MILK" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                      <option>Dairy</option>
                      <option>Beverages</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              <button onClick={() => { setShowAddModal(false); handleAction('Product Add Mocked'); }} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm">
                Save Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
