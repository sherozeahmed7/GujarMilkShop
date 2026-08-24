import React, { useState, useEffect, useCallback } from 'react';
import { KhataSummaryCards } from '../components/khata/KhataSummaryCards';
import { KhataCashCollectModal } from '../components/khata/KhataCashCollectModal';
import { KhataLedgerModal } from '../components/khata/KhataLedgerModal';
import { KhataCustomerFormModal } from '../components/khata/KhataCustomerFormModal';
import {
  customerService,
  LedgerSummaryStats,
} from '../services/customer.service';
import { ApiCustomer } from '../types/customer';
import { useDebounce } from '../hooks/useDebounce';
import {
  Search, Download, FileText, Printer, Filter, Plus,
  DollarSign, BookOpen, Edit2, Trash2, CheckCircle2, RefreshCw
} from 'lucide-react';

const EMPTY_SUMMARY: LedgerSummaryStats = {
  khataAccounts: 0,
  totalOutstanding: 0,
  collectedToday: 0,
  pendingCount: 0,
  paidCount: 0,
};

function typeBadge(t: ApiCustomer['customerType']) {
  return t === 'monthly_ledger' ? 'Monthly' : 'Daily';
}

export const KhataLedger: React.FC = () => {
  const [customers, setCustomers] = useState<ApiCustomer[]>([]);
  const [summary, setSummary] = useState<LedgerSummaryStats>(EMPTY_SUMMARY);
  const [totalCount, setTotalCount] = useState(0);

  const [collectCustomer, setCollectCustomer] = useState<ApiCustomer | null>(null);
  const [ledgerCustomer, setLedgerCustomer] = useState<ApiCustomer | null>(null);
  const [formCustomer, setFormCustomer] = useState<ApiCustomer | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'All' | 'Paid' | 'Pending'>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 400);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const duesStatus =
        filterMode === 'Pending' ? 'pending' : filterMode === 'Paid' ? 'paid' : undefined;

      const [list, ledgerSummary] = await Promise.all([
        customerService.getCustomers({
          status: 'active',
          search: debouncedSearch.trim() || undefined,
          duesStatus,
        }),
        customerService.getLedgerSummary(),
      ]);

      setCustomers(list);
      setSummary(ledgerSummary);
      setTotalCount(ledgerSummary.khataAccounts);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Khata ledger');
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const cycleFilter = () => {
    setFilterMode((prev) =>
      prev === 'All' ? 'Pending' : prev === 'Pending' ? 'Paid' : 'All'
    );
  };

  const handleDelete = async (c: ApiCustomer) => {
    if (!window.confirm(`Remove ${c.name} from Khata? They will be marked inactive.`)) {
      return;
    }
    try {
      await customerService.deleteCustomer(c.id);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete customer');
    }
  };

  const handleOpenAdd = () => {
    setFormCustomer(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (c: ApiCustomer) => {
    setFormCustomer(c);
    setIsFormOpen(true);
  };

  const handleExcelExport = () => {
    const rows = [
      ['Name', 'Phone', 'Customer Type', 'Balance', 'Address', 'Last Sale'],
      ...customers.map((c) => [
        c.name,
        c.phone || 'Not Available',
        typeBadge(c.customerType),
        String(c.totalDue ?? 0),
        c.address || 'Not Available',
        c.lastSaleDate
          ? new Date(c.lastSaleDate).toLocaleDateString()
          : 'Not Available',
      ]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'khata_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

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
          <p>Accounts: ${summary.khataAccounts} · Outstanding: Rs. ${Math.round(summary.totalOutstanding).toLocaleString()} · Collected today: Rs. ${Math.round(summary.collectedToday).toLocaleString()}</p>
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Customer Type</th><th>Balance</th><th>Last Sale</th></tr></thead>
            <tbody>
              ${customers
                .map((c) => {
                  const bal = c.totalDue ?? 0;
                  return `<tr>
                <td>${c.name}</td>
                <td>${c.phone || 'Not Available'}</td>
                <td>${typeBadge(c.customerType)}</td>
                <td class="${bal > 0 ? 'bal' : 'clear'}">${bal > 0 ? 'Rs. ' + Math.round(bal).toLocaleString() : 'Clear'}</td>
                <td>${c.lastSaleDate ? new Date(c.lastSaleDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Not Available'}</td>
              </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </body>
      </html>`;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(printContent);
      win.document.close();
      win.print();
    }
  };

  const filterLabel =
    filterMode === 'All'
      ? 'Paid / Pending'
      : filterMode === 'Pending'
        ? `Pending (${summary.pendingCount})`
        : `Paid (${summary.paidCount})`;

  return (
    <div className="flex flex-col h-full gap-5 overflow-hidden">
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Khata Ledger</h1>
          <p className="text-slate-500 text-sm mt-1">Manage credit customers and track payments</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleExcelExport}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            Excel
          </button>
          <button
            type="button"
            onClick={handleDailyPrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors"
          >
            <FileText className="w-4 h-4 text-blue-600" />
            PDF
          </button>
          <button
            type="button"
            onClick={handleDailyPrint}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors"
          >
            <Printer className="w-4 h-4 text-amber-600" />
            Daily Print
          </button>
          <button
            type="button"
            onClick={cycleFilter}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border shadow-sm transition-colors ${
              filterMode !== 'All'
                ? 'bg-amber-500 text-white border-amber-500'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            {filterLabel}
          </button>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Customer
          </button>
        </div>
      </div>

      {error && (
        <div className="flex-shrink-0 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-medium">
          {error}
        </div>
      )}

      <div className="flex-shrink-0">
        <KhataSummaryCards summary={summary} loading={loading} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <div className="relative max-w-lg">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name or phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full table-fixed text-left border-collapse">
            <thead className="bg-slate-50 sticky top-0 z-10">
              <tr>
                <th className="w-[22%] px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  Name
                </th>
                <th className="w-[16%] px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  Phone
                </th>
                <th className="w-[14%] px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  Customer Type
                </th>
                <th className="w-[14%] px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  Balance
                </th>
                <th className="w-[12%] px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  Last Sale
                </th>
                <th className="w-[22%] px-5 py-3.5 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-400">
                    Loading customers…
                  </td>
                </tr>
              ) : customers.length === 0 ? (
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
                customers.map((c) => {
                  const balance = c.totalDue ?? 0;
                  const initials = c.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();
                  const isMonthly = c.customerType === 'monthly_ledger';

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-slate-800 truncate">{c.name}</p>
                            {c.address && (
                              <p className="text-[10px] text-slate-400 truncate">
                                {c.address}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-600 truncate">
                        {c.phone?.trim() ? c.phone : 'Not Available'}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            isMonthly
                              ? 'bg-violet-100 text-violet-700'
                              : 'bg-sky-100 text-sky-700'
                          }`}
                        >
                          {typeBadge(c.customerType)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {balance > 0 ? (
                          <span className="font-bold text-sm text-rose-600">
                            Rs. {Math.round(balance).toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-100">
                            <CheckCircle2 className="w-3 h-3" /> Clear
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-sm text-slate-500">
                        {c.lastSaleDate
                          ? new Date(c.lastSaleDate).toLocaleDateString('en-GB', {
                              day: '2-digit',
                              month: 'short',
                            })
                          : 'Not Available'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap opacity-100 lg:opacity-60 lg:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => setCollectCustomer(c)}
                            disabled={balance <= 0}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                              balance > 0
                                ? 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600 shadow-sm'
                                : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                            }`}
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Cash Collect
                          </button>
                          <button
                            type="button"
                            onClick={() => setLedgerCustomer(c)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            Ledger
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(c)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
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

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex-shrink-0">
          <p className="text-xs font-medium text-slate-500">
            Showing {customers.length} of {totalCount} customers
            {filterMode !== 'All' && ` · Filter: ${filterMode}`}
          </p>
        </div>
      </div>

      {isFormOpen && (
        <KhataCustomerFormModal
          customer={formCustomer}
          onClose={() => setIsFormOpen(false)}
          onSaved={loadData}
        />
      )}
      {collectCustomer && (
        <KhataCashCollectModal
          customer={collectCustomer}
          onClose={() => setCollectCustomer(null)}
          onCollected={loadData}
        />
      )}
      {ledgerCustomer && (
        <KhataLedgerModal
          customer={ledgerCustomer}
          onClose={() => setLedgerCustomer(null)}
        />
      )}
    </div>
  );
};
