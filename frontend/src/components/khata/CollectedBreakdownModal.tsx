import React, { useState, useEffect, useMemo } from "react";
import { X, Users, TrendingUp, Phone, MapPin, AlertCircle } from "lucide-react";
import { customerService, CollectedBreakdownEntry } from "../../services/customer.service";
import { supplierService } from "../../services/supplier.service";
import { SupplierPaymentRecord } from "../../types";

interface CollectedBreakdownModalProps {
  mode: "customers" | "suppliers";
  periodLabel: string;
  fromDate?: string;
  toDate?: string;
  onClose: () => void;
}

function fmt(n: number) { return `Rs. ${Math.round(n).toLocaleString()}`; }
function typeBadge(t: string) {
  if (t === "monthly_ledger") return "Monthly";
  if (t === "daily_ledger") return "Daily";
  return t || "—";
}
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return iso; }
}

export const CollectedBreakdownModal: React.FC<CollectedBreakdownModalProps> = ({
  mode, periodLabel, fromDate, toDate, onClose,
}) => {
  const [rows, setRows] = useState<CollectedBreakdownEntry[]>([]);
  const [supplierRows, setSupplierRows] = useState<SupplierPaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true); setError(null);
      try {
        if (mode === "customers") {
          const data = await customerService.getCollectedBreakdown(fromDate, toDate);
          if (!cancelled) setRows(data);
        } else {
          const data = await supplierService.listPayments({ fromDate, toDate });
          if (!cancelled) setSupplierRows(data);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Failed to load breakdown");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mode, fromDate, toDate]);

  const supplierAggregated = useMemo(() => {
    const map = new Map<string, { supplierId: string; supplierName: string; supplierCode: string; totalPaid: number; paymentCount: number; lastDate: string | null }>();
    for (const row of supplierRows) {
      const ex = map.get(row.supplierId);
      if (ex) { ex.totalPaid += row.amount; ex.paymentCount += 1; if (!ex.lastDate || row.date > ex.lastDate) ex.lastDate = row.date; }
      else map.set(row.supplierId, { supplierId: row.supplierId, supplierName: row.supplierName, supplierCode: row.supplierCode, totalPaid: row.amount, paymentCount: 1, lastDate: row.date });
    }
    return Array.from(map.values()).sort((a, b) => b.totalPaid - a.totalPaid);
  }, [supplierRows]);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.customerName.toLowerCase().includes(q) || (r.phone || "").toLowerCase().includes(q) || (r.address || "").toLowerCase().includes(q));
  }, [rows, search]);

  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return supplierAggregated;
    const q = search.toLowerCase();
    return supplierAggregated.filter((r) => r.supplierName.toLowerCase().includes(q) || r.supplierCode.toLowerCase().includes(q));
  }, [supplierAggregated, search]);

  const grandTotal = mode === "customers" ? filteredCustomers.reduce((s, r) => s + r.totalPaid, 0) : filteredSuppliers.reduce((s, r) => s + r.totalPaid, 0);
  const totalCount = mode === "customers" ? filteredCustomers.length : filteredSuppliers.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#2d4a35] w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">
                {mode === "customers" ? "Customer Collections" : "Supplier Payments"} — {periodLabel}
              </h2>
              <p className="text-xs text-slate-500 dark:text-[#8ba895] mt-0.5">
                {mode === "customers" ? "Customers who made payments in this period" : "Suppliers who received payments in this period"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-xl transition-colors"><X className="w-5 h-5 text-slate-500" /></button>
        </div>
        <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 font-semibold">
            <Users className="w-4 h-4" />
            {totalCount} {mode === "customers" ? "customer" : "supplier"}{totalCount !== 1 ? "s" : ""} {mode === "customers" ? "paid" : "received payment"}
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xs text-emerald-600/70 dark:text-emerald-400/70 font-semibold uppercase tracking-wider">Total:</span>
            <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">{fmt(grandTotal)}</span>
          </div>
        </div>
        <div className="px-6 py-3 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0">
          <input type="text" placeholder={`Search by ${mode === "customers" ? "name, phone, or address" : "name or code"}...`} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-4 py-2 text-sm bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-800 dark:text-[#e2f5e8] rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-16 text-slate-400">
              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              Loading payment breakdown...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-3 py-16 text-rose-500"><AlertCircle className="w-5 h-5" />{error}</div>
          ) : totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400 dark:text-[#64916e]">
              <Users className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">No payments recorded for this period</p>
            </div>
          ) : mode === "customers" ? (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e] w-10">#</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e]">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e]">Phone</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e]">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e] text-center">Txns</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e]">Last Payment</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e] text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                {filteredCustomers.map((row, idx) => {
                  const initials = row.customerName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
                  return (
                    <tr key={row.customerId} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-400 text-xs font-black flex-shrink-0">{initials}</div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-[#e2f5e8]">{row.customerName}</p>
                            {row.address && <p className="text-[11px] text-slate-400 flex items-center gap-0.5 mt-0.5"><MapPin className="w-3 h-3" />{row.address}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">
                        {row.phone ? <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-slate-400" />{row.phone}</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 text-[11px] font-bold rounded-md border ${row.customerType === "monthly_ledger" ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/40" : "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/40"}`}>{typeBadge(row.customerType)}</span>
                      </td>
                      <td className="px-4 py-3 text-center"><span className="text-sm font-bold text-slate-700 dark:text-[#e2f5e8]">{row.paymentCount}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#8ba895] whitespace-nowrap">{fmtDate(row.lastPaymentDate)}</td>
                      <td className="px-4 py-3 text-right"><span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(row.totalPaid)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-[#111e14] border-t-2 border-slate-300 dark:border-[#2d4a35]">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wide">Total — {filteredCustomers.length} customer{filteredCustomers.length !== 1 ? "s" : ""}</td>
                  <td className="px-4 py-3 text-right text-base font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{fmt(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e] w-10">#</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e]">Supplier</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e]">Code</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e] text-center">Payments</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e]">Last Date</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-[#64916e] text-right">Total Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                {filteredSuppliers.map((row, idx) => {
                  const initials = row.supplierName.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
                  return (
                    <tr key={row.supplierId} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                      <td className="px-4 py-3 text-sm text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-700 dark:text-amber-400 text-xs font-black flex-shrink-0">{initials}</div>
                          <p className="text-sm font-semibold text-slate-800 dark:text-[#e2f5e8]">{row.supplierName}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-slate-500 dark:text-[#8ba895]">{row.supplierCode || "—"}</td>
                      <td className="px-4 py-3 text-center"><span className="text-sm font-bold text-slate-700 dark:text-[#e2f5e8]">{row.paymentCount}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-500 dark:text-[#8ba895] whitespace-nowrap">{row.lastDate || "—"}</td>
                      <td className="px-4 py-3 text-right"><span className="text-sm font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{fmt(row.totalPaid)}</span></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-100 dark:bg-[#111e14] border-t-2 border-slate-300 dark:border-[#2d4a35]">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-[#a7c4ae] uppercase tracking-wide">Total — {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? "s" : ""}</td>
                  <td className="px-4 py-3 text-right text-base font-black text-emerald-700 dark:text-emerald-300 tabular-nums">{fmt(grandTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
