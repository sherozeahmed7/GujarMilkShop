import React, { useEffect, useState, useMemo } from 'react';
import {
  Search, Filter, Calendar, History,
  ArrowDownToLine, ArrowUpFromLine
} from 'lucide-react';
import { CashbookTransaction, CashbookTransactionFilters } from '../../types/cashbook';
import { getCashbookTransactions, getCashPersons } from '../../services/cashbook.service';
import { CashPerson } from '../../types/cashbook';
import { Pagination } from '../common/Pagination';

interface Props {
  refreshKey: number;
}

const fmt = (n: number) => `Rs. ${(isNaN(n) || !isFinite(n) ? 0 : n).toLocaleString()}`;

const formatDateTime = (isoString: string) => {
  try {
    const d = new Date(isoString);
    return d.toLocaleString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch {
    return isoString;
  }
};

const TYPE_FILTERS = ['All', 'Incoming', 'Outgoing', 'Received', 'Paid'] as const;
type TypeFilter = typeof TYPE_FILTERS[number];

const DATE_FILTERS = ['All Time', 'Today', 'This Week', 'This Month', 'Custom'] as const;
type DateFilter = typeof DATE_FILTERS[number];

const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const TransactionHistory: React.FC<Props> = ({ refreshKey }) => {
  const [txns, setTxns] = useState<CashbookTransaction[]>([]);
  const [persons, setPersons] = useState<CashPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('All Time');
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const loadTxns = async () => {
    setIsLoading(true);
    const filters: CashbookTransactionFilters = {};
    if (typeFilter !== 'All') filters.type = typeFilter as any;
    if (dateFilter !== 'All Time' && dateFilter !== 'Custom') filters.dateRange = dateFilter as any;
    if (dateFilter === 'Custom') {
      filters.dateRange = 'Custom';
      filters.fromDate = fromDate;
      filters.toDate = toDate;
    }
    try {
      const [t, p] = await Promise.all([getCashbookTransactions(filters), getCashPersons()]);
      setTxns(t || []);
      setPersons(p || []);
    } catch (e) {
      console.error('Failed to load cashbook transactions:', e);
      setTxns([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTxns();
  }, [refreshKey, typeFilter, dateFilter, fromDate, toDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, typeFilter, dateFilter, fromDate, toDate]);

  // Client-side search (by person name, description, amount, or creator)
  const filtered = useMemo(() => {
    return txns.filter((t) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (
        t.cashPersonName.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.createdBy && t.createdBy.toLowerCase().includes(q)) ||
        String(t.amount).includes(q)
      );
    });
  }, [txns, search]);

  const paginated = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Totals from filtered
  const totalAmountIn = filtered
    .filter(t => t.transactionType === 'Receive Amount' || t.transactionType === 'Opening Balance')
    .reduce((s, t) => s + t.amount, 0);
  const totalAmountOut = filtered
    .filter(t => t.transactionType === 'Pay Amount')
    .reduce((s, t) => s + t.amount, 0);

  const personMap: Record<string, CashPerson> = {};
  persons.forEach(p => { personMap[p.id] = p; });

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
      {/* Section Header */}
      <div className="p-5 border-b border-slate-100 dark:border-[#2d4a35]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] flex items-center gap-2">
              <History className="w-4 h-4 text-blue-500" />
              Transaction History
            </h3>
            <p className="text-xs text-slate-400 dark:text-[#64916e] mt-0.5">All cashbook transactions — permanent record, no deletions.</p>
          </div>
          {/* Totals */}
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
              <ArrowDownToLine className="w-3.5 h-3.5" /> In: {fmt(totalAmountIn)}
            </span>
            <span className="flex items-center gap-1.5 text-rose-600 font-semibold bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
              <ArrowUpFromLine className="w-3.5 h-3.5" /> Out: {fmt(totalAmountOut)}
            </span>
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap gap-2 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-[#64916e] pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search transactions…"
              className="pl-8 pr-4 py-1.5 text-xs border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] dark:placeholder-[#64916e] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#111e14] rounded-lg p-1">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${typeFilter === f ? 'bg-white dark:bg-[#1a2e1f] text-slate-800 dark:text-[#e2f5e8] shadow-sm' : 'text-slate-500 dark:text-[#8ba895] hover:text-slate-700 dark:hover:text-[#e2f5e8]'}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#111e14] rounded-lg p-1">
            {DATE_FILTERS.filter(f => f !== 'Custom').map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${dateFilter === f ? 'bg-white dark:bg-[#1a2e1f] text-slate-800 dark:text-[#e2f5e8] shadow-sm' : 'text-slate-500 dark:text-[#8ba895] hover:text-slate-700 dark:hover:text-[#e2f5e8]'}`}
              >
                {f === 'All Time' ? 'All' : f}
              </button>
            ))}
            <button
              onClick={() => setDateFilter('Custom')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${dateFilter === 'Custom' ? 'bg-white dark:bg-[#1a2e1f] text-slate-800 dark:text-[#e2f5e8] shadow-sm' : 'text-slate-500 dark:text-[#8ba895] hover:text-slate-700 dark:hover:text-[#e2f5e8]'}`}
            >
              <Calendar className="w-3 h-3" /> Custom
            </button>
          </div>
        </div>

        {/* Custom date range */}
        {dateFilter === 'Custom' && (
          <div className="flex items-center gap-2 mt-3">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-xs text-slate-400 dark:text-[#64916e]">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 dark:border-[#2d4a35] bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-10 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
            <span className="text-sm text-slate-400 dark:text-[#64916e]">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-10 h-10 text-slate-200 dark:text-[#2d4a35] mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-[#8ba895]">No transactions found.</p>
            <p className="text-xs text-slate-400 dark:text-[#64916e] mt-1">Try adjusting the filters or date range.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35] bg-slate-50/50 dark:bg-[#142119]">
                <th className="text-left px-5 py-3">Date & Time</th>
                <th className="text-left px-4 py-3">Person</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-right px-4 py-3">Amount In</th>
                <th className="text-right px-4 py-3">Amount Out</th>
                <th className="text-left px-4 py-3">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-[#1e3124]">
              {paginated.map((txn) => {
                const isReceive = txn.transactionType === 'Receive Amount';
                const isOpening = txn.transactionType === 'Opening Balance';
                const person = personMap[txn.cashPersonId];
                return (
                  <tr key={txn.id} className="hover:bg-slate-50/60 dark:hover:bg-[#1e3124] transition-colors">
                    <td className="px-5 py-3.5 text-slate-500 dark:text-[#8ba895] whitespace-nowrap text-xs">{formatDateTime(txn.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${person?.type === 'Incoming' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                          {txn.cashPersonName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800 dark:text-[#e2f5e8] whitespace-nowrap">{txn.cashPersonName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                        isOpening ? 'bg-slate-100 dark:bg-[#111e14] text-slate-600 dark:text-[#a7c4ae]' :
                        isReceive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {isReceive && <ArrowDownToLine className="w-3 h-3" />}
                        {!isReceive && !isOpening && <ArrowUpFromLine className="w-3 h-3" />}
                        {txn.transactionType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-[#8ba895] max-w-[180px]">
                      <span className="truncate block">{txn.description || <span className="text-slate-300 dark:text-[#2d4a35]">—</span>}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-emerald-600 whitespace-nowrap">
                      {(isReceive || isOpening) ? fmt(txn.amount) : <span className="text-slate-300 dark:text-[#2d4a35]">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-rose-500 whitespace-nowrap">
                      {!isReceive && !isOpening ? fmt(txn.amount) : <span className="text-slate-300 dark:text-[#2d4a35]">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 dark:text-[#8ba895] text-xs whitespace-nowrap">{txn.createdBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination Footer */}
      {filtered.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
          itemLabel="transactions"
        />
      )}
    </div>
  );
};
