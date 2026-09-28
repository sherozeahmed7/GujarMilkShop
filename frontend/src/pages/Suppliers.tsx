import React, { useEffect, useState } from 'react';
import { Search, Plus, Droplets, RefreshCw, Banknote } from 'lucide-react';
import { useSupplierStore } from '../store/supplierStore';
import { SupplierDetails } from '../components/suppliers/SupplierDetails';
import { SupplierFormModal } from '../components/suppliers/SupplierFormModal';
import { SupplierPaymentsHistory } from '../components/suppliers/SupplierPaymentsHistory';

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
  const [pageView, setPageView] = useState<'farms' | 'payments'>('farms');

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredSuppliers = suppliers.filter((sup) => {
    if (!showInactive && !sup.isActive) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        sup.name.toLowerCase().includes(query) ||
        sup.code.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

  const totalPayables = suppliers.reduce(
    (acc, sup) => acc + Math.max(0, Number(sup.payableBalance) || 0),
    0
  );
  const todayStr = localDateKey(new Date());
  const todaysMilk = collections
    .filter((collection) => collection.date === todayStr)
    .reduce((total, collection) => total + collection.quantity, 0);

  const formatCurrency = (amount: number) => {
    const n = Number(amount) || 0;
    if (n < 0) {
      return `Rs. −${Math.abs(n).toLocaleString(undefined, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })}`;
    }
    return `Rs. ${n.toLocaleString(undefined, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}`;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between mb-4 flex-shrink-0 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">
            Suppliers & Milk Purchase
          </h1>
          <p className="text-slate-500 dark:text-[#64916e] text-sm mt-1">
            {pageView === 'farms'
              ? 'Select a farm to add entries or make payments.'
              : 'Payment history by farm, shift, method, and date.'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="inline-flex rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#1a2e1f] p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setPageView('farms')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                pageView === 'farms'
                  ? 'bg-slate-800 dark:bg-[#22c55e] text-white dark:text-[#0d1a10]'
                  : 'text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124]'
              }`}
            >
              Farms
            </button>
            <button
              type="button"
              onClick={() => setPageView('payments')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1.5 ${
                pageView === 'payments'
                  ? 'bg-emerald-600 dark:bg-[#22c55e] text-white dark:text-[#0d1a10]'
                  : 'text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124]'
              }`}
            >
              <Banknote className="w-3.5 h-3.5" />
              Payment records
            </button>
          </div>

          {pageView === 'farms' && (
            <>
              <div className="relative w-64">
                <Search className="w-4 h-4 text-slate-400 dark:text-[#64916e] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search anything..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-lg pl-9 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="w-px h-10 bg-slate-200 dark:bg-[#2d4a35]" />

              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-500 dark:text-[#64916e] uppercase tracking-wider">
                  Today&apos;s Milk
                </span>
                <span className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">
                  {todaysMilk.toFixed(2)} kg
                </span>
              </div>
              <div className="w-px h-10 bg-slate-200 dark:bg-[#2d4a35]" />
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Total Payables
                </span>
                <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {formatCurrency(totalPayables)}
                </span>
              </div>
              <div className="w-px h-10 bg-slate-200 dark:bg-[#2d4a35]" />
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Next-Cycle Credit
                </span>
                <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(
                    suppliers.reduce((sum, s) => sum + (s.guaranteedAdvance || 0), 0)
                  )}
                </span>
              </div>
              <button
                type="button"
                onClick={() => fetchData()}
                className="ml-2 p-2 h-fit bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#86efac] rounded-lg hover:bg-slate-50 dark:hover:bg-[#223927] shadow-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 px-4 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {pageView === 'payments' ? (
        <div className="flex-1 min-h-0 bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-100 dark:border-[#2d4a35] overflow-hidden">
          <SupplierPaymentsHistory
            suppliers={suppliers}
            initialSupplierId={selectedSupplierId || undefined}
          />
        </div>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0">
          <div className="w-[320px] bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col overflow-hidden flex-shrink-0">
            <div className="p-4 border-b border-slate-100 dark:border-[#2d4a35] flex flex-col gap-3 flex-shrink-0 bg-slate-50/50 dark:bg-[#142119]/50">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-800 dark:text-[#e2f5e8] flex items-center gap-2">
                  <UsersIcon className="w-4 h-4 text-blue-600 dark:text-[#22c55e]" />
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
                    className="flex items-center gap-1 bg-[#166534] hover:bg-[#14532d] active:bg-[#0f3d21] text-white px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-xs transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {filteredSuppliers.map((sup) => (
                <button
                  key={sup.id}
                  onClick={() => setSelectedSupplierId(sup.id)}
                  className={`w-full flex items-start justify-between p-3 rounded-xl mb-1 transition-all text-left ${
                    selectedSupplierId === sup.id
                      ? 'bg-[#FEF3C7]/60 dark:bg-[#22c55e]/10 border border-[#FDE68A] dark:border-[#22c55e]/40 shadow-xs'
                      : 'hover:bg-[#FEF3C7]/30 dark:hover:bg-[#223927] border border-transparent'
                  } ${!sup.isActive ? 'opacity-60' : ''}`}
                >
                  <div>
                    <h3
                      className={`font-bold text-sm ${
                        selectedSupplierId === sup.id ? 'text-[#166534] dark:text-[#22c55e]' : 'text-slate-800 dark:text-[#e2f5e8]'
                      }`}
                    >
                      {sup.name}
                    </h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5 block">
                      {sup.code}
                    </span>
                  </div>
                  <div className="text-right">
                    <div
                      className={`font-bold text-sm ${
                        selectedSupplierId === sup.id ? 'text-[#166534] dark:text-[#22c55e]' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {formatCurrency(sup.payableBalance)}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mt-0.5">
                      {sup.cycleType}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-100 dark:border-[#2d4a35] flex flex-col overflow-hidden relative">
            {selectedSupplier ? (
              <SupplierDetails supplier={selectedSupplier} />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-[#64916e] gap-3">
                <Droplets className="w-12 h-12 text-slate-200 dark:text-[#2d4a35]" />
                <p className="text-sm font-medium text-slate-500 dark:text-[#64916e]">
                  Select a farm from the list to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {isAddModalOpen && <SupplierFormModal onClose={() => setIsAddModalOpen(false)} />}
    </div>
  );
};

const UsersIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);
