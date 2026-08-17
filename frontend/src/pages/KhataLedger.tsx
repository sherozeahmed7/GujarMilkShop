import React, { useState } from 'react';
import { KhataSummaryCards } from '../components/khata/KhataSummaryCards';
import { KhataCashCollectModal } from '../components/khata/KhataCashCollectModal';
import { KhataLedgerModal } from '../components/khata/KhataLedgerModal';
import { KhataCustomerFormModal } from '../components/khata/KhataCustomerFormModal';
import { useCustomerStore } from '../store/customerStore';
import { Customer } from '../types';
import {
  Search, Download, FileText, Printer, Filter, Plus,
  DollarSign, BookOpen, Edit2, Trash2, CheckCircle2
} from 'lucide-react';

export const KhataLedger: React.FC = () => {
  const { customers, deleteCustomer } = useCustomerStore();

  // Modal states
  const [collectCustomer, setCollectCustomer] = useState<Customer | null>(null);
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);
  const [formCustomer, setFormCustomer] = useState<Customer | undefined>(undefined);
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'All' | 'Paid' | 'Pending'>('All');

  // Derived: filter customers
  const filteredCustomers = customers.filter(c => {
    if (filterMode === 'Paid' && c.balance > 0) return false;
    if (filterMode === 'Pending' && c.balance <= 0) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.cardNumber.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pendingCount = customers.filter(c => c.balance > 0).length;
  const paidCount = customers.filter(c => c.balance <= 0).length;

  const handleDelete = (c: Customer) => {
    if (window.confirm(`Delete ${c.name} from Khata? This cannot be undone.`)) {
      deleteCustomer(c.id);
    }
  };

  const handleOpenAdd = () => { setFormCustomer(undefined); setIsFormOpen(true); };
  const handleOpenEdit = (c: Customer) => { setFormCustomer(c); setIsFormOpen(true); };

  // CSV Export
  const handleExcelExport = () => {
    const rows = [
      ['Card No', 'Name', 'Phone', 'Balance', 'Address', 'Last Sale'],
      ...filteredCustomers.map(c => [
        c.cardNumber, c.name, c.phone, c.balance, c.address,
        c.lastSaleDate ?? 'Never'
      ])
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'khata_export.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // PDF / Print the daily Khata summary
  const handleDailyPrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Daily Khata Report — ${new Date().toLocaleDateString()}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 12px; }
            h2 { margin-bottom: 2px; } p { color:#666; margin-bottom:16px; }
            table { width:100%; border-collapse:collapse; }
            th { background:#f1f5f9; text-align:left; padding:8px 12px; font-size:10px; text-transform:uppercase; letter-spacing:.05em; color:#64748b; }
            td { padding:8px 12px; border-bottom:1px solid #e2e8f0; }
            .bal { font-weight:bold; color:#dc2626; }
            .clear { color:#16a34a; font-weight:bold; }
          </style>
        </head>
        <body>
          <h2>Daily Khata Report</h2>
          <p>Gujar Milk Shop — ${new Date().toLocaleString()}</p>
          <table>
            <thead><tr><th>Card</th><th>Name</th><th>Phone</th><th>Balance</th><th>Last Sale</th></tr></thead>
            <tbody>
              ${filteredCustomers.map(c => `<tr>
                <td>${c.cardNumber}</td>
                <td>${c.name}</td>
                <td>${c.phone || '—'}</td>
                <td class="${c.balance > 0 ? 'bal' : 'clear'}">${c.balance > 0 ? 'Rs. ' + c.balance.toLocaleString() : 'Clear'}</td>
                <td>${c.lastSaleDate ?? 'Never'}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>`;
    const win = window.open('', '_blank');
    if (win) { win.document.write(printContent); win.document.close(); win.print(); }
  };

  return (
    <div className="flex flex-col h-full gap-5 overflow-hidden">

      {/* ── Page Header ──────────────────────────────────── */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Khata Ledger</h1>
          <p className="text-slate-500 text-sm mt-1">Manage credit customers and track payments</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExcelExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors">
            <Download className="w-4 h-4 text-emerald-600" />
            Excel
          </button>
          <button onClick={handleDailyPrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors">
            <FileText className="w-4 h-4 text-blue-600" />
            PDF
          </button>
          <button onClick={handleDailyPrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors">
            <Printer className="w-4 h-4 text-amber-600" />
            Daily Print
          </button>
          <button
            onClick={() => setFilterMode(prev => prev === 'All' ? 'Pending' : 'All')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border shadow-sm transition-colors ${filterMode === 'Pending' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            <Filter className="w-4 h-4" />
            {filterMode === 'All' ? `Paid / Pending` : filterMode === 'Pending' ? `Pending (${pendingCount})` : `Paid (${paidCount})`}
          </button>
          <button onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors">
            <Plus className="w-4 h-4" />
            New Customer
          </button>
        </div>
      </div>

      {/* ── Summary Cards ───────────────────────────────── */}
      <div className="flex-shrink-0">
        <KhataSummaryCards />
      </div>

      {/* ── Table Card ──────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <div className="relative max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by Card No, Name, or Phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">Card No</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">Name</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">Phone</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">Balance</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">Last Sale</th>
                <th className="px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <CheckCircle2 className="w-10 h-10 text-slate-200" />
                      <p className="text-sm font-medium">No customers found</p>
                      <p className="text-xs">Try adjusting your search or filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(c => {
                  const initials = c.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* Card No */}
                      <td className="px-5 py-3">
                        {c.cardNumber ? (
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-full border-2 border-slate-200 bg-white text-sm font-bold text-slate-700">
                            {c.cardNumber}
                          </span>
                        ) : <span className="text-slate-400">—</span>}
                      </td>
                      {/* Name */}
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-800">{c.name}</p>
                            {c.address && <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{c.address}</p>}
                          </div>
                        </div>
                      </td>
                      {/* Phone */}
                      <td className="px-5 py-3 text-sm text-slate-600">{c.phone || '—'}</td>
                      {/* Balance */}
                      <td className="px-5 py-3">
                        {c.balance > 0 ? (
                          <span className="font-bold text-sm text-rose-600">Rs. {c.balance.toLocaleString()}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3" /> Clear
                          </span>
                        )}
                      </td>
                      {/* Last Sale */}
                      <td className="px-5 py-3 text-sm text-slate-500">
                        {c.lastSaleDate ? new Date(c.lastSaleDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Never'}
                      </td>
                      {/* Actions */}
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-60 lg:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setCollectCustomer(c)}
                            disabled={c.balance <= 0}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${c.balance > 0 ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 shadow-sm' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'}`}
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Cash Collect
                          </button>
                          <button
                            onClick={() => setLedgerCustomer(c)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Ledger
                          </button>
                          <button
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <p className="text-xs font-medium text-slate-500">
            Showing {filteredCustomers.length} of {customers.length} customers
            {filterMode !== 'All' && ` · Filter: ${filterMode}`}
          </p>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────── */}
      {isFormOpen && (
        <KhataCustomerFormModal customer={formCustomer} onClose={() => setIsFormOpen(false)} />
      )}
      {collectCustomer && (
        <KhataCashCollectModal customer={collectCustomer} onClose={() => setCollectCustomer(null)} />
      )}
      {ledgerCustomer && (
        <KhataLedgerModal customer={ledgerCustomer} onClose={() => setLedgerCustomer(null)} />
      )}

    </div>
  );
};
