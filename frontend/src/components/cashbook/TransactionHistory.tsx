import React, { useEffect, useState } from 'react';
import {
  Search, Filter, Calendar, History,
  ArrowDownToLine, ArrowUpFromLine
} from 'lucide-react';
import { CashbookTransaction, CashbookTransactionFilters } from '../../types/cashbook';
import { getCashbookTransactions, getCashPersons } from '../../services/cashbook.service';
import { CashPerson } from '../../types/cashbook';

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

const todayStr = () => new Date().toISOString().slice(0, 10);

export const TransactionHistory: React.FC<Props> = ({ refreshKey }) => {
  const [txns, setTxns] = useState<CashbookTransaction[]>([]);
  const [persons, setPersons] = useState<CashPerson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('All');
  const [dateFilter, setDateFilter] = useState<DateFilter>('All Time');
  const [fromDate, setFromDate] = useState(todayStr());
  const [toDate, setToDate] = useState(todayStr());

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
    const [t, p] = await Promise.all([getCashbookTransactions(filters), getCashPersons()]);
    setTxns(t);
    setPersons(p);
    setIsLoading(false);
  };

  useEffect(() => { loadTxns(); }, [refreshKey, typeFilter, dateFilter, fromDate, toDate]);

  // Client-side search (by person name)
  const filtered = txns.filter((t) => {
    if (!search) return true;
    return t.cashPersonName.toLowerCase().includes(search.toLowerCase());
  });

  // Totals from filtered
  const totalAmountIn = filtered.filter(t => t.transactionType === 'Receive Amount').reduce((s, t) => s + t.amount, 0);
  const totalAmountOut = filtered.filter(t => t.transactionType === 'Pay Amount').reduce((s, t) => s + t.amount, 0);

  const personMap: Record<string, CashPerson> = {};
  persons.forEach(p => { personMap[p.id] = p; });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Section Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-500" />
              Transaction History
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">All cashbook transactions — permanent record, no deletions.</p>
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by person…"
              className="pl-8 pr-4 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-44"
            />
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${typeFilter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
            {DATE_FILTERS.filter(f => f !== 'Custom').map((f) => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${dateFilter === f ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {f === 'All Time' ? 'All' : f}
              </button>
            ))}
            <button
              onClick={() => setDateFilter('Custom')}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${dateFilter === 'Custom' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
              max={toDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              min={fromDate}
              max={todayStr()}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="p-10 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
            <span className="text-sm text-slate-400">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <History className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500">No transactions found.</p>
            <p className="text-xs text-slate-400 mt-1">Try adjusting the filters or date range.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3">Date & Time</th>
                <th className="text-left px-4 py-3">Person</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Description</th>
                <th className="text-right px-4 py-3">Amount In</th>
                <th className="text-right px-4 py-3">Amount Out</th>
                <th className="text-left px-4 py-3">Recorded By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((txn) => {
                const isReceive = txn.transactionType === 'Receive Amount';
                const isOpening = txn.transactionType === 'Opening Balance';
                const person = personMap[txn.cashPersonId];
                return (
                  <tr key={txn.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap text-xs">{formatDateTime(txn.createdAt)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${person?.type === 'Incoming' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                          {txn.cashPersonName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800 whitespace-nowrap">{txn.cashPersonName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                        isOpening ? 'bg-slate-100 text-slate-600' :
                        isReceive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {isReceive && <ArrowDownToLine className="w-3 h-3" />}
                        {!isReceive && !isOpening && <ArrowUpFromLine className="w-3 h-3" />}
                        {txn.transactionType}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 max-w-[180px]">
                      <span className="truncate block">{txn.description || <span className="text-slate-300">—</span>}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-emerald-600 whitespace-nowrap">
                      {(isReceive || isOpening) ? fmt(txn.amount) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-rose-500 whitespace-nowrap">
                      {!isReceive && !isOpening ? fmt(txn.amount) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{txn.createdBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
