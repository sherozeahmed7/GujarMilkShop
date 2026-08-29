import React, { useEffect, useState } from 'react';
import { Search, Plus, Droplets, RefreshCw } from 'lucide-react';
import { useSupplierStore } from '../store/supplierStore';
import { SupplierDetails } from '../components/suppliers/SupplierDetails';
import { SupplierFormModal } from '../components/suppliers/SupplierFormModal';

const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const Suppliers: React.FC = () => {
  const { suppliers, collections, fetchData, error } = useSupplierStore();
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Filter suppliers
  const filteredSuppliers = suppliers.filter(sup => {
    if (!showInactive && !sup.isActive) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return sup.name.toLowerCase().includes(query) || sup.code.toLowerCase().includes(query);
    }
    return true;
  });

  const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

  // Quick stats - Calculate from ALL suppliers, not just filtered ones
  const totalPayables = suppliers.reduce((acc, sup) => acc + sup.payableBalance, 0);
  const todayStr = localDateKey(new Date());
  const todaysMilk = collections
    .filter((collection) => collection.date === todayStr)
    .reduce((total, collection) => total + collection.quantity, 0);

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Page Header & Stats ───────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Suppliers & Milk Purchase</h1>
          <p className="text-slate-500 text-sm mt-1">Select a farm to add entries or make payments.</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search anything..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          
          <div className="w-px h-10 bg-slate-200"></div>
          
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Milk</span>
            <span className="text-lg font-bold text-slate-800">{todaysMilk.toFixed(2)} kg</span>
          </div>
          <div className="w-px h-10 bg-slate-200"></div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Payables</span>
            <span className="text-lg font-bold text-amber-600">{formatCurrency(totalPayables)}</span>
          </div>
          <div className="w-px h-10 bg-slate-200"></div>
          <div className="flex flex-col items-end">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Next-Cycle Credit</span>
            <span className="text-lg font-bold text-emerald-600">{formatCurrency(0)}</span>
          </div>
          <button className="ml-2 p-2 h-fit bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 shadow-sm transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>}

      {/* ── Main Layout (Left List, Right Details) ─────────────────────── */}
      <div className="flex gap-6 flex-1 min-h-0">
        
        {/* Left Column: Supplier List */}
        <div className="w-[320px] bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden flex-shrink-0">
          <div className="p-4 border-b border-slate-100 flex flex-col gap-3 flex-shrink-0 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <UsersIcon className="w-4 h-4 text-blue-600" />
                Farms
              </h2>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                  />
                  Inactive
                </label>
                <button 
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  Add
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {filteredSuppliers.map(sup => (
              <button
                key={sup.id}
                onClick={() => setSelectedSupplierId(sup.id)}
                className={`w-full flex items-start justify-between p-3 rounded-xl mb-1 transition-all text-left ${
                  selectedSupplierId === sup.id 
                    ? 'bg-blue-50 border border-blue-200 shadow-sm' 
                    : 'hover:bg-slate-50 border border-transparent'
                } ${!sup.isActive ? 'opacity-60' : ''}`}
              >
                <div>
                  <h3 className={`font-semibold text-sm ${selectedSupplierId === sup.id ? 'text-blue-900' : 'text-slate-800'}`}>
                    {sup.name}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono mt-0.5 block">{sup.code}</span>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-sm ${selectedSupplierId === sup.id ? 'text-blue-700' : 'text-slate-700'}`}>
                    {formatCurrency(sup.payableBalance)}
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mt-0.5">
                    {sup.cycleType}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Column: Supplier Details & Data Entry */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden relative">
          {selectedSupplier ? (
            <SupplierDetails supplier={selectedSupplier} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
              <Droplets className="w-12 h-12 text-slate-200" />
              <p className="text-sm font-medium">Select a farm from the list to view details</p>
            </div>
          )}
        </div>

      </div>

      {isAddModalOpen && (
        <SupplierFormModal onClose={() => setIsAddModalOpen(false)} />
      )}
    </div>
  );
};

// Helper component
const UsersIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);
