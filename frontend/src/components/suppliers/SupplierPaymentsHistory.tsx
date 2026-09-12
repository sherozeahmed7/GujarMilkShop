import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Calendar, Filter, RefreshCw, Search } from 'lucide-react';
import { Supplier, SupplierPaymentRecord } from '../../types';
import { supplierService } from '../../services/supplier.service';
import { shiftService } from '../../services/shift.service';
import { ShiftRecord } from '../../types';

const todayStr = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const monthStartStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

function methodLabel(method: string): string {
  const m = (method || 'cash').toLowerCase();
  if (m === 'discount') return 'Discount';
  if (m === 'bank_transfer') return 'Bank transfer';
  if (m === 'jazzcash') return 'JazzCash';
  if (m === 'cash') return 'Cash';
  return method.replace(/_/g, ' ');
}

function methodBadgeClass(method: string): string {
  const m = (method || 'cash').toLowerCase();
  if (m === 'cash') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (m === 'discount') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (m === 'jazzcash') return 'bg-violet-50 text-violet-700 border-violet-100';
  return 'bg-sky-50 text-sky-700 border-sky-100';
}

interface Props {
  suppliers: Supplier[];
  /** Prefill supplier filter when opened from a farm */
  initialSupplierId?: string;
}

export const SupplierPaymentsHistory: React.FC<Props> = ({ suppliers, initialSupplierId }) => {
  const [rows, setRows] = useState<SupplierPaymentRecord[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState(monthStartStr);
  const [toDate, setToDate] = useState(todayStr);
  const [supplierId, setSupplierId] = useState(initialSupplierId || '');
  const [shiftDate, setShiftDate] = useState('');
  const [method, setMethod] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (initialSupplierId) setSupplierId(initialSupplierId);
  }, [initialSupplierId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [payments, shiftList] = await Promise.all([
        supplierService.listPayments({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          supplierId: supplierId || undefined,
          shiftDate: shiftDate || undefined,
          method: method !== 'all' ? method : undefined,
        }),
        shiftService.getShifts().catch(() => [] as ShiftRecord[]),
      ]);
      setRows(payments);
      setShifts(shiftList);
    } catch (err: any) {
      setError(err?.message || 'Failed to load supplier payments.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, supplierId, shiftDate, method]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.supplierName.toLowerCase().includes(q) ||
        r.supplierCode.toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q) ||
        (r.shiftDate || '').includes(q)
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    let cash = 0;
    let other = 0;
    let discount = 0;
    for (const r of filtered) {
      const m = (r.method || '').toLowerCase();
      if (m === 'discount') discount += r.amount;
      else if (m === 'cash') cash += r.amount;
      else other += r.amount;
    }
    return { cash, other, discount, all: cash + other + discount };
  }, [filtered]);

  const fmt = (n: number) => `Rs. ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-shrink-0 border-b border-slate-100 bg-white px-5 py-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600" />
              Supplier payment records
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Which farm was paid, from which shift drawer, how much, and on which date.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            From
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 font-medium"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            To
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 font-medium"
            />
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Supplier
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 font-medium bg-white"
            >
              <option value="">All farms</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Shift date
            <select
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 font-medium bg-white"
            >
              <option value="">All shifts</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.date}>
                  {s.date} {s.status === 'Open' ? '(Open)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Method
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              className="border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-700 font-medium bg-white"
            >
              <option value="all">All methods</option>
              <option value="cash">Cash (from shift)</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="jazzcash">JazzCash</option>
              <option value="discount">Discount</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Search
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Farm, notes…"
                className="w-full border border-slate-200 rounded-lg pl-8 pr-2.5 py-1.5 text-sm text-slate-700 font-medium"
              />
            </div>
          </label>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-slate-600">
            <Filter className="w-3 h-3" />
            {filtered.length} record{filtered.length === 1 ? '' : 's'}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 font-semibold">
            Cash {fmt(totals.cash)}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-100 text-sky-700 font-semibold">
            Bank / Jazz {fmt(totals.other)}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 font-semibold">
            Discount {fmt(totals.discount)}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-white font-semibold">
            Total {fmt(totals.all)}
          </span>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-sm text-slate-400 gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Loading payments…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
            <Calendar className="w-8 h-8 text-slate-200" />
            <p className="text-sm font-medium">No payments match these filters</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                <tr>
                  <th className="text-left px-3 py-2.5">Date</th>
                  <th className="text-left px-3 py-2.5">Supplier</th>
                  <th className="text-left px-3 py-2.5">Shift</th>
                  <th className="text-left px-3 py-2.5">Method</th>
                  <th className="text-right px-3 py-2.5">Amount</th>
                  <th className="text-left px-3 py-2.5">Notes</th>
                  <th className="text-left px-3 py-2.5">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{r.date}</td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-800">{r.supplierName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{r.supplierCode}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.shiftDate ? (
                        <div>
                          <div className="font-medium text-slate-700">{r.shiftDate}</div>
                          <div className="text-[11px] text-slate-400">
                            {r.shiftStatus || 'Linked'}
                            {r.shiftId != null ? ` · #${r.shiftId}` : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">— (not cash / no shift)</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-md text-[11px] font-bold border ${methodBadgeClass(
                          r.method
                        )}`}
                      >
                        {methodLabel(r.method)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-slate-800 whitespace-nowrap">
                      {fmt(r.amount)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 max-w-[180px] truncate" title={r.notes || ''}>
                      {r.notes || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{r.createdBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
