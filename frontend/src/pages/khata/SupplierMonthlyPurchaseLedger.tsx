import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar, Printer, Info,
  CreditCard, Package,
} from 'lucide-react';
import {
  supplierLedgerService,
  PurchaseEntry,
  SupplierPaymentEntry,
  SupplierLedgerSummary,
  SupplierInfo,
} from '../../services/supplierLedgerService';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEK_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string, opts?: Intl.DateTimeFormatOptions): string {
  // Parse as local date to avoid UTC offset issues
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts ?? { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtAmount(n: number): string {
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const SupplierMonthlyPurchaseLedger: React.FC = () => {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();

  // ── Date state ──
  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(today.getFullYear());

  // ── Data state ──
  const [loading,  setLoading]  = useState(true);
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [entries,  setEntries]  = useState<PurchaseEntry[]>([]);
  const [payments, setPayments] = useState<SupplierPaymentEntry[]>([]);
  const [summary,  setSummary]  = useState<SupplierLedgerSummary | null>(null);
  const [error,    setError]    = useState<string | null>(null);

  // ── Modal state ──
  const [detailDate, setDetailDate] = useState<{ date: string; entries: PurchaseEntry[] } | null>(null);

  // ── Fetch ──
  useEffect(() => {
    if (!supplierId) return;
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [supp, ents, pays, summ] = await Promise.all([
          supplierLedgerService.getSupplier(supplierId),
          supplierLedgerService.getMonthlyPurchaseEntries(supplierId, selectedMonth, selectedYear),
          supplierLedgerService.getMonthlyPayments(supplierId, selectedMonth, selectedYear),
          supplierLedgerService.getMonthlySummary(supplierId, selectedMonth, selectedYear),
        ]);
        if (alive) {
          setSupplier(supp);
          setEntries(ents);
          setPayments(pays);
          setSummary(summ);
        }
      } catch (e: any) {
        if (alive) setError(e?.message ?? 'Failed to load supplier ledger');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, [supplierId, selectedMonth, selectedYear]);

  // ── Calendar grid ──
  const calendarDays = useMemo(() => {
    const daysInMonth   = new Date(selectedYear, selectedMonth, 0).getDate();
    const firstWeekday  = new Date(selectedYear, selectedMonth - 1, 1).getDay();
    const totalCells    = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    return Array.from({ length: totalCells }, (_, i) => {
      if (i < firstWeekday || i >= firstWeekday + daysInMonth) return null;
      return i - firstWeekday + 1;
    });
  }, [selectedMonth, selectedYear]);

  // ── Entries grouped by YYYY-MM-DD ──
  const entriesByDate = useMemo(() => {
    const map = new Map<string, PurchaseEntry[]>();
    entries.forEach(e => {
      const existing = map.get(e.date) ?? [];
      existing.push(e);
      map.set(e.date, existing);
    });
    return map;
  }, [entries]);

  // ── Calendar total (sourced from same data as calendar cells) ──
  const calendarTotal = useMemo(
    () => entries.reduce((s, e) => s + e.amount, 0),
    [entries]
  );

  // ── Month navigation ──
  const goPrev = () => {
    if (selectedMonth === 1) { setSelectedMonth(12); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const goNext = () => {
    if (selectedMonth === 12) { setSelectedMonth(1); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };
  const goCurrent = () => { setSelectedMonth(today.getMonth() + 1); setSelectedYear(today.getFullYear()); };

  // ── PDF generation ──
  const handlePrint = () => {
    const calRows = Array.from({ length: Math.ceil(calendarDays.length / 7) })
      .map((_, row) =>
        `<tr>${calendarDays.slice(row * 7, row * 7 + 7).map(day => {
          if (!day) return '<td></td>';
          const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEntries = entriesByDate.get(dateStr) ?? [];
          const amt = dayEntries.reduce((s, e) => s + e.amount, 0);
          return `<td class="day-cell"><span class="day-num">${day}</span>${amt > 0 ? `Rs. ${Math.round(amt).toLocaleString()}` : '-'}</td>`;
        }).join('')}</tr>`
      ).join('');

    const payRows = payments.map(p =>
      `<tr><td>${fmtDate(p.date)}</td><td>${p.paymentMethod}</td><td>${fmtAmount(p.amount)}</td><td>${p.reference}</td><td>${p.addedBy}</td></tr>`
    ).join('') || '<tr><td colspan="5" style="text-align:center;color:#888">No payments this month</td></tr>';

    const purchaseRows = entries.map(e =>
      `<tr><td>${fmtDate(e.date, { day: '2-digit', month: 'short' })}</td><td>${e.product}</td><td>${e.quantity.toFixed(2)} ${e.unit}</td><td>Rs. ${e.rate}</td><td>${fmtAmount(e.amount)}</td></tr>`
    ).join('') || '<tr><td colspan="5" style="text-align:center;color:#888">No purchases this month</td></tr>';

    const html = `
      <html><head>
        <title>Supplier Purchase Statement — ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}</title>
        <style>
          body { font-family: sans-serif; padding: 24px; font-size: 12px; color: #1e293b; }
          h2 { margin: 0 0 4px; font-size: 18px; }
          h3 { margin: 0 0 16px; font-size: 13px; font-weight: normal; color: #64748b; }
          .meta p { margin: 2px 0; color: #475569; }
          .summary-box { border: 1px solid #e2e8f0; padding: 16px; background: #f8fafc; margin: 20px 0; border-radius: 8px; }
          .summary-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; }
          .summary-row.total { font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th { background: #f1f5f9; text-align: left; padding: 7px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: #64748b; border: 1px solid #e2e8f0; }
          td { padding: 7px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
          .day-cell { min-height: 52px; }
          .day-num { font-weight: bold; display: block; margin-bottom: 3px; }
          .section-title { font-size: 13px; font-weight: bold; margin: 20px 0 8px; color: #1e293b; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
        </style>
      </head><body>
        <div style="text-align: center; margin-bottom: 20px;">
          <img src="/logo.png" alt="Gujjar Milk Shop" style="height: 64px; object-fit: contain; margin-bottom: 10px;" />
          <h2 style="margin: 0;">GUJJAR MILK SHOP</h2>
          <h3 style="margin-top: 5px; color: #555;">Supplier Monthly Purchase Statement</h3>
        </div>
        <div class="meta">
          <p><strong>Supplier:</strong> ${supplier?.name ?? 'Unknown'}</p>
          <p><strong>Phone:</strong> ${supplier?.phone ?? 'N/A'}</p>
          <p><strong>Cycle:</strong> ${supplier?.cycleType ?? 'N/A'}</p>
          <p><strong>Period:</strong> ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}</p>
        </div>
        <div class="summary-box">
          <div class="summary-row"><span>Current Month Purchases:</span><span>${fmtAmount(summary?.currentMonthAmount ?? 0)}</span></div>
          <div class="summary-row"><span>Previous Balance:</span><span>${fmtAmount(summary?.previousBalance ?? 0)}</span></div>
          <div class="summary-row total"><span>Total Payable:</span><span>${fmtAmount(summary?.totalPayable ?? 0)}</span></div>
          <div class="summary-row"><span>Total Paid:</span><span>${fmtAmount(summary?.totalPaid ?? 0)}</span></div>
          <div class="summary-row total"><span>Remaining Payable:</span><span>${fmtAmount(summary?.remaining ?? 0)}</span></div>
        </div>
        <div class="section-title">Monthly Calendar — ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}</div>
        <table>
          <thead><tr>${WEEK_DAYS.map(d => `<th>${d}</th>`).join('')}</tr></thead>
          <tbody>${calRows}</tbody>
        </table>
        <div class="section-title">Payment History</div>
        <table>
          <thead><tr><th>Date</th><th>Method</th><th>Amount</th><th>Reference</th><th>Added By</th></tr></thead>
          <tbody>${payRows}</tbody>
        </table>
        <div class="section-title">Purchase Detail</div>
        <table>
          <thead><tr><th>Date</th><th>Product</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>${purchaseRows}</tbody>
        </table>
      </body></html>`;

    const win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); win.print(); }
  };

  // ─── Early returns ────────────────────────────────────────────────────────
  if (loading && !supplier) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 text-sm font-medium">
        Loading supplier ledger…
      </div>
    );
  }
  if (error && !supplier) {
    return (
      <div className="flex h-full items-center justify-center text-rose-500 text-sm font-medium">
        {error}
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar bg-slate-50/50">

      {/* ── Sticky Header ── */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Left: back + title */}
          <div>
            <button
              onClick={() => navigate('/ledger')}
              className="flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors text-sm font-medium mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Khata / Ledger
            </button>
            <h1 className="text-xl font-bold text-slate-800">Supplier Monthly Ledger</h1>
          </div>

          {/* Right: month nav + PDF */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              <button onClick={goPrev} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors shadow-sm" title="Previous Month">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={goCurrent} className="px-3 py-1.5 hover:bg-white rounded-lg text-sm font-bold text-slate-700 transition-colors shadow-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </button>
              <button onClick={goNext} className="p-1.5 hover:bg-white rounded-lg text-slate-600 transition-colors shadow-sm" title="Next Month">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              Generate PDF
            </button>
          </div>
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="p-6 w-full space-y-6">

        {/* ── Supplier Info Card ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-wrap gap-x-12 gap-y-4 items-center">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Supplier Name</p>
            <p className="text-lg font-bold text-slate-800">{supplier?.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Phone</p>
            <p className="text-base font-semibold text-slate-700">{supplier?.phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Payment Cycle</p>
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold uppercase">
              {supplier?.cycleType}
            </span>
          </div>
          <div className="ml-auto">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Payable Balance</p>
            <p className="text-xl font-black text-amber-600">{fmtAmount(supplier?.payableBalance ?? 0)}</p>
          </div>
        </div>

        {/* ── Full-Width Calendar ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Calendar header */}
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-lg">
              Monthly Purchase Ledger &mdash; {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </h3>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
            {WEEK_DAYS.map(d => (
              <div key={d} className="p-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200 last:border-0 truncate">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Loading calendar…</div>
          ) : (
            <div className="grid grid-cols-7 bg-slate-200 gap-px">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} className="bg-slate-50 min-h-[120px]" />;

                const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEntries = entriesByDate.get(dateStr) ?? [];
                const dailyAmt   = dayEntries.reduce((s, e) => s + e.amount, 0);
                const hasTxn     = dailyAmt > 0;

                const isToday =
                  today.getDate() === day &&
                  today.getMonth() + 1 === selectedMonth &&
                  today.getFullYear() === selectedYear;

                return (
                  <div
                    key={`d-${day}`}
                    onClick={() => hasTxn && setDetailDate({ date: dateStr, entries: dayEntries })}
                    className={`bg-white min-h-[120px] p-3 flex flex-col ${hasTxn ? 'cursor-pointer hover:bg-amber-50/60 transition-colors' : ''}`}
                  >
                    {/* Date number */}
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-base font-bold w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-amber-500 text-white shadow-sm' : hasTxn ? 'text-slate-700' : 'text-slate-400'}`}>
                        {day}
                      </span>
                      {isToday && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-1.5 mr-0.5">Today</span>}
                    </div>

                    {/* Daily amount */}
                    {hasTxn ? (
                      <div className="flex flex-col mt-auto">
                        <p className="text-base font-bold text-amber-600">{fmtAmount(dailyAmt)}</p>
                        {dayEntries.length > 1 && (
                          <span className="text-[10px] text-slate-400 mt-0.5">{dayEntries.length} entries</span>
                        )}
                      </div>
                    ) : (
                      <p className="text-xl text-slate-300 mt-auto font-medium">-</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Calendar footer: monthly total */}
          {!loading && (
            <div className="border-t border-slate-200 bg-slate-50 p-4 flex items-center justify-end">
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">Total Monthly Purchases</p>
                <p className="text-xl font-bold text-amber-600">{fmtAmount(calendarTotal)}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom: Summary + Payments ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Monthly Summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <Info className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-800 text-lg">Monthly Summary</h3>
            </div>
            {loading || !summary ? (
              <div className="p-8 flex-1 flex items-center justify-center text-sm text-slate-400">Calculating…</div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Current Month Purchases</p>
                  <p className="text-xl font-bold text-slate-800">{fmtAmount(summary.currentMonthAmount)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Previous Balance</p>
                  <p className="text-xl font-bold text-amber-600">{fmtAmount(summary.previousBalance)}</p>
                </div>
                <div className="sm:col-span-2 h-px bg-slate-100" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Payable</p>
                  <p className="text-xl font-bold text-rose-600">{fmtAmount(summary.totalPayable)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Paid</p>
                  <p className="text-xl font-bold text-emerald-600">{fmtAmount(summary.totalPaid)}</p>
                </div>
                <div className="sm:col-span-2 mt-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800 uppercase tracking-wider">Remaining Payable</p>
                  <p className="text-2xl font-black text-amber-600">{fmtAmount(summary.remaining)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Payment Summary */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-slate-800 text-lg">Payment Summary</h3>
            </div>

            {/* Quick stats */}
            {!loading && (
              <div className="grid grid-cols-3 border-b border-slate-100 p-5 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Paid</p>
                  <p className="text-lg font-bold text-emerald-600">{fmtAmount(summary?.totalPaid ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Payments</p>
                  <p className="text-lg font-bold text-slate-800">{payments.length}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Last Payment</p>
                  <p className="text-sm font-bold text-slate-800 pt-0.5">
                    {payments.length > 0
                      ? fmtDate(payments[payments.length - 1].date, { day: '2-digit', month: 'short' })
                      : '-'}
                  </p>
                </div>
              </div>
            )}

            {/* Payment table */}
            <div className="flex-1 overflow-auto bg-slate-50/50">
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-400">Loading payments…</div>
              ) : payments.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-400 font-medium">No payments this month</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Method</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Reference</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">{fmtDate(p.date)}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600">{p.paymentMethod}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">{p.reference || '-'}</td>
                        <td className="px-5 py-3.5 text-sm font-bold text-emerald-600 text-right">{fmtAmount(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ── Purchase Detail Table ── */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-slate-800 text-lg">Purchase Detail</h3>
            <span className="ml-auto text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              {entries.length} entries
            </span>
          </div>
          <div className="overflow-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400">Loading purchases…</div>
            ) : entries.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400 font-medium">No purchases this month</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Product</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Qty</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Rate</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5 text-sm text-slate-600">
                        {fmtDate(e.date, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {e.product}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-slate-700">
                        {e.quantity.toFixed(2)} {e.unit}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500">Rs. {e.rate.toLocaleString()}/{e.unit}</td>
                      <td className="px-5 py-3.5 text-sm font-bold text-slate-800 text-right">{fmtAmount(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer total row */}
                <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={4} className="px-5 py-3 text-sm font-bold text-slate-700 text-right uppercase tracking-wider">
                      Total
                    </td>
                    <td className="px-5 py-3 text-base font-black text-amber-600 text-right">
                      {fmtAmount(calendarTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

      </div>{/* /page body */}

      {/* ── Daily Detail Modal ── */}
      {detailDate && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4"
          onClick={() => setDetailDate(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-lg">
                {fmtDate(detailDate.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <button
                onClick={() => setDetailDate(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors text-lg leading-none"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {detailDate.entries.map((e, i) => (
                <div key={e.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 relative">
                  <div className="absolute -top-2.5 left-4 bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                    DELIVERY {i + 1}
                  </div>
                  <div className="flex justify-between items-start mt-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{e.product}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{e.time} · {e.quantity.toFixed(2)} {e.unit} × Rs. {e.rate.toLocaleString()}/{e.unit}</p>
                    </div>
                    <p className="text-base font-bold text-amber-600">{fmtAmount(e.amount)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal footer: daily total */}
            <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="font-bold text-slate-800">Daily Total</span>
              <span className="text-lg font-black text-amber-600">
                {fmtAmount(detailDate.entries.reduce((s, e) => s + e.amount, 0))}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
