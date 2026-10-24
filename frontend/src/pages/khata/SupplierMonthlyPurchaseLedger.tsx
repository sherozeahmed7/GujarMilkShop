import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar, Printer, Info,
  CreditCard, Package, Download, FileText,
} from 'lucide-react';
import { savePdfDocument } from '../../utils/exportUtils';
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
const SHIFTS = ['Morning', 'Evening'] as const;

function shiftQuantity(entries: PurchaseEntry[], shift: PurchaseEntry['shift']): string {
  const deliveries = entries.filter(entry => entry.shift === shift && entry.quantity > 0);
  if (deliveries.length === 0) return '-';
  return `${deliveries.reduce((sum, entry) => sum + entry.quantity, 0).toLocaleString('en-GB', { maximumFractionDigits: 3 })} kg`;
}

function shiftAmount(entries: PurchaseEntry[], shift: PurchaseEntry['shift']): string {
  const deliveries = entries.filter(entry => entry.shift === shift && entry.quantity > 0);
  return deliveries.length > 0 ? fmtAmount(deliveries.reduce((sum, entry) => sum + entry.amount, 0)) : '-';
}

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
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());

  // ── Data state ──
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [entries, setEntries] = useState<PurchaseEntry[]>([]);
  const [payments, setPayments] = useState<SupplierPaymentEntry[]>([]);
  const [summary, setSummary] = useState<SupplierLedgerSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const firstWeekday = new Date(selectedYear, selectedMonth - 1, 1).getDay();
    const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleGeneratePdf = async () => {
    if (!supplier) return;
    setIsGeneratingPdf(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const monthLabel = `${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`;

      // Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('GUJJAR MILK SHOP', 14, 16);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('Supplier Monthly Purchase Statement', 14, 22);

      // Supplier Info Box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 26, 182, 18, 2, 2, 'FD');

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Supplier:', 18, 32);
      doc.text('Phone:', 18, 38);
      doc.text('Period:', 110, 32);
      doc.text('Cycle Type:', 110, 38);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(supplier.name || '—', 36, 32);
      doc.text(supplier.phone || 'N/A', 36, 38);
      doc.text(monthLabel, 136, 32);
      doc.text(supplier.cycleType || 'N/A', 136, 38);

      // Financial Summary Box
      const summaryItems = [
        ['Current Month Purchases', `Rs. ${(summary?.currentMonthAmount ?? 0).toLocaleString()}`],
        ['Previous Balance', `Rs. ${(summary?.previousBalance ?? 0).toLocaleString()}`],
        ['Total Payable', `Rs. ${(summary?.totalPayable ?? 0).toLocaleString()}`],
        ['Total Paid', `Rs. ${(summary?.totalPaid ?? 0).toLocaleString()}`],
        ['Remaining Payable', `Rs. ${(summary?.remaining ?? 0).toLocaleString()}`],
      ];

      autoTable(doc, {
        body: summaryItems,
        startY: 48,
        styles: { fontSize: 8.5, cellPadding: 2.5 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50, textColor: [71, 85, 105] },
          1: { fontStyle: 'bold', halign: 'right', textColor: [15, 23, 42] },
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: 'grid',
      });

      let nextY = (doc as any).lastAutoTable?.finalY + 8 || 85;

      // Calendar Overview
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`Monthly Calendar Overview (${monthLabel})`, 14, nextY);

      const calRows: string[][] = [];
      const totalWeeks = Math.ceil(calendarDays.length / 7);
      for (let r = 0; r < totalWeeks; r++) {
        const rowCells = calendarDays.slice(r * 7, (r + 1) * 7).map((day) => {
          if (!day) return '';
          const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayEntries = entriesByDate.get(dateStr) ?? [];
          const dailyAmount = dayEntries.reduce((sum, entry) => sum + entry.amount, 0);
          return `${day}\n${SHIFTS.map(shift => `${shift}: ${shiftQuantity(dayEntries, shift)}\n${shiftAmount(dayEntries, shift)}`).join('\n')}\nTotal: ${dayEntries.length ? fmtAmount(dailyAmount) : '-'}`;
        });
        while (rowCells.length < 7) rowCells.push('');
        calRows.push(rowCells);
      }

      autoTable(doc, {
        head: [WEEK_DAYS.map(w => w.slice(0, 3))],
        body: calRows,
        startY: nextY + 3,
        styles: { fontSize: 7, cellPadding: 2, halign: 'center', valign: 'middle', minCellHeight: 11 },
        headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
        theme: 'grid',
      });

      nextY = (doc as any).lastAutoTable?.finalY + 8 || 150;

      // Payments Table
      if (payments.length > 0) {
        if (nextY > 230) {
          doc.addPage();
          nextY = 20;
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Payment History', 14, nextY);

        const paymentRows = payments.map(p => [
          p.date ? new Date(p.date).toLocaleDateString('en-GB') : '—',
          p.paymentMethod || 'Cash',
          `Rs. ${Math.round(Number(p.amount || 0)).toLocaleString()}`,
          p.reference || '—',
          p.addedBy || '—',
        ]);

        autoTable(doc, {
          head: [['Date', 'Method', 'Amount', 'Reference', 'Added By']],
          body: paymentRows,
          startY: nextY + 3,
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [16, 185, 129], textColor: 255 },
          theme: 'striped',
        });

        nextY = (doc as any).lastAutoTable?.finalY + 8 || 200;
      }

      // Purchases Table
      if (entries.length > 0) {
        if (nextY > 230) {
          doc.addPage();
          nextY = 20;
        }
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Purchase Details', 14, nextY);

        const purchaseRows = entries.map(e => [
          e.date ? new Date(e.date).toLocaleDateString('en-GB') : '—',
          e.shift || '-',
          e.product || 'Milk',
          `${Number(e.quantity || 0).toFixed(2)} ${e.unit || 'kg'}`,
          `Rs. ${Number(e.rate || 0).toLocaleString()}`,
          `Rs. ${Math.round(Number(e.amount || 0)).toLocaleString()}`,
        ]);

        autoTable(doc, {
          head: [['Date', 'Shift', 'Product', 'Quantity', 'Rate', 'Total']],
          body: purchaseRows,
          startY: nextY + 3,
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: [51, 65, 85], textColor: 255 },
          theme: 'striped',
        });
      }

      const safeName = (supplier.name || 'Supplier').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Supplier_Purchase_Statement_${safeName}_${selectedMonth}_${selectedYear}.pdf`;
      await savePdfDocument(doc, filename);
    } catch (err) {
      console.error('[Supplier Ledger] PDF generation failed:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // ─── Early returns ────────────────────────────────────────────────────────
  if (loading && !supplier) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 dark:text-[#64916e] text-sm font-medium">
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
    <div className="flex flex-col h-full overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-[#142119]">

      {/* ── Sticky Header ── */}
      <div className="bg-white dark:bg-[#1a2e1f] border-b border-slate-200 dark:border-[#2d4a35] px-6 py-4 sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Left: back + title */}
          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-slate-500 dark:text-[#8ba895] hover:text-blue-600 transition-colors text-sm font-medium mb-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <h1 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">Supplier Monthly Ledger</h1>
          </div>

          {/* Right: month nav + PDF */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#111e14] p-1 rounded-xl">
              <button onClick={goPrev} className="p-1.5 hover:bg-white dark:hover:bg-[#1a2e1f] rounded-lg text-slate-600 dark:text-[#a7c4ae] transition-colors shadow-sm" title="Previous Month">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button onClick={goCurrent} className="px-3 py-1.5 hover:bg-white dark:hover:bg-[#1a2e1f] rounded-lg text-sm font-bold text-slate-700 dark:text-[#e2f5e8] transition-colors shadow-sm flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
              </button>
              <button onClick={goNext} className="p-1.5 hover:bg-white dark:hover:bg-[#1a2e1f] rounded-lg text-slate-600 dark:text-[#a7c4ae] transition-colors shadow-sm" title="Next Month">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <button
              onClick={handleGeneratePdf}
              disabled={isGeneratingPdf || !supplier}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" />
              {isGeneratingPdf ? 'Saving PDF…' : 'Generate PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Page body ── */}
      <div className="p-6 w-full space-y-6">

        {/* ── Supplier Info Card ── */}
        <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d4a35] p-5 flex flex-wrap gap-x-12 gap-y-4 items-center">
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-[#64916e] uppercase tracking-wider mb-1">Supplier Name</p>
            <p className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">{supplier?.name}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-[#64916e] uppercase tracking-wider mb-1">Phone</p>
            <p className="text-base font-semibold text-slate-700 dark:text-[#e2f5e8]">{supplier?.phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 dark:text-[#64916e] uppercase tracking-wider mb-1">Payment Cycle</p>
            <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold uppercase">
              {supplier?.cycleType}
            </span>
          </div>
          <div className="ml-auto">
            <p className="text-xs font-semibold text-slate-400 dark:text-[#64916e] uppercase tracking-wider mb-1">Payable Balance</p>
            <p className="text-xl font-black text-amber-600">{fmtAmount(supplier?.payableBalance ?? 0)}</p>
          </div>
        </div>

        {/* ── Full-Width Calendar ── */}
        <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
          {/* Calendar header */}
          <div className="p-4 border-b border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex items-center justify-between">
            <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-lg">
              Monthly Purchase Ledger &mdash; {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </h3>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 border-b border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119]">
            {WEEK_DAYS.map(d => (
              <div key={d} className="p-3 text-center text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider border-r border-slate-200 dark:border-[#2d4a35] last:border-0 truncate">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="p-12 text-center text-slate-400 dark:text-[#64916e] text-sm">Loading calendar…</div>
          ) : (
            <div className="grid grid-cols-7 bg-slate-200 dark:bg-[#1e3124] gap-px">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} className="bg-slate-50 dark:bg-[#142119] min-h-[120px]" />;

                const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayEntries = entriesByDate.get(dateStr) ?? [];
                const hasTxn = dayEntries.length > 0;

                const isToday =
                  today.getDate() === day &&
                  today.getMonth() + 1 === selectedMonth &&
                  today.getFullYear() === selectedYear;

                return (
                  <div
                    key={`d-${day}`}
                    onClick={() => hasTxn && setDetailDate({ date: dateStr, entries: dayEntries })}
                    className={`bg-white dark:bg-[#1a2e1f] min-h-[120px] p-3 flex flex-col ${hasTxn ? 'cursor-pointer hover:bg-amber-50/60 transition-colors' : ''}`}
                  >
                    {/* Date number */}
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-base font-bold w-8 h-8 flex items-center justify-center rounded-full ${isToday ? 'bg-amber-500 text-white shadow-sm' : hasTxn ? 'text-slate-700 dark:text-[#e2f5e8]' : 'text-slate-400 dark:text-[#64916e]'}`}>
                        {day}
                      </span>
                      {isToday && <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mt-1.5 mr-0.5">Today</span>}
                    </div>

                    <div className="mt-auto space-y-2">
                      {SHIFTS.map(shift => (
                        <div key={shift} className="flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                          <span className="text-slate-500 dark:text-[#8ba895]">{shift}</span>
                          <span className="font-bold text-amber-600 tabular-nums">{shiftQuantity(dayEntries, shift)}</span>
                          <span className="w-full text-right font-semibold text-slate-700 dark:text-[#e2f5e8] tabular-nums">{shiftAmount(dayEntries, shift)}</span>
                        </div>
                      ))}
                      {hasTxn && (
                        <div className="border-t border-slate-200 dark:border-[#2d4a35] pt-2 text-sm font-bold text-amber-600 tabular-nums">
                          Total: {fmtAmount(dayEntries.reduce((sum, entry) => sum + entry.amount, 0))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Calendar footer: monthly total */}
          {!loading && (
            <div className="border-t border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] p-4 flex items-center justify-end">
              <div className="text-right">
                <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-0.5">Total Monthly Purchases</p>
                <p className="text-xl font-bold text-amber-600">{fmtAmount(calendarTotal)}</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom: Summary + Payments ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Monthly Summary */}
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex items-center gap-2">
              <Info className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-lg">Monthly Summary</h3>
            </div>
            {loading || !summary ? (
              <div className="p-8 flex-1 flex items-center justify-center text-sm text-slate-400 dark:text-[#64916e]">Calculating…</div>
            ) : (
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Current Month Purchases</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">{fmtAmount(summary.currentMonthAmount)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Previous Balance</p>
                  <p className="text-xl font-bold text-amber-600">{fmtAmount(summary.previousBalance)}</p>
                </div>
                <div className="sm:col-span-2 h-px bg-slate-100 dark:bg-[#111e14]" />
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Total Payable</p>
                  <p className="text-xl font-bold text-rose-600">{fmtAmount(summary.totalPayable)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Total Paid</p>
                  <p className="text-xl font-bold text-emerald-600">{fmtAmount(summary.totalPaid)}</p>
                </div>
                <div className="sm:col-span-2 mt-2 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] uppercase tracking-wider">Remaining Payable</p>
                  <p className="text-2xl font-black text-amber-600">{fmtAmount(summary.remaining)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Payment Summary */}
          <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-lg">Payment Summary</h3>
            </div>

            {/* Quick stats */}
            {!loading && (
              <div className="grid grid-cols-3 border-b border-slate-100 dark:border-[#2d4a35] p-5 gap-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Total Paid</p>
                  <p className="text-lg font-bold text-emerald-600">{fmtAmount(summary?.totalPaid ?? 0)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Payments</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">{payments.length}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Last Payment</p>
                  <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] pt-0.5">
                    {payments.length > 0
                      ? fmtDate(payments[payments.length - 1].date, { day: '2-digit', month: 'short' })
                      : '-'}
                  </p>
                </div>
              </div>
            )}

            {/* Payment table */}
            <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-[#142119]">
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-400 dark:text-[#64916e]">Loading payments…</div>
              ) : payments.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-400 dark:text-[#64916e] font-medium">No payments this month</div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-100 dark:bg-[#111e14] border-b border-slate-200 dark:border-[#2d4a35]">
                    <tr>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Date</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Method</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Reference</th>
                      <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35] bg-white dark:bg-[#1a2e1f]">
                    {payments.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-[#e2f5e8]">{fmtDate(p.date)}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-[#a7c4ae]">{p.paymentMethod}</td>
                        <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-[#8ba895] font-mono">{p.reference || '-'}</td>
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
        <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
          <div className="p-5 border-b border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-lg">Purchase Detail</h3>
            <span className="ml-auto text-xs font-semibold text-slate-400 dark:text-[#64916e] bg-slate-100 dark:bg-[#111e14] px-2.5 py-1 rounded-full">
              {entries.length} entries
            </span>
          </div>
          <div className="overflow-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-slate-400 dark:text-[#64916e]">Loading purchases…</div>
            ) : entries.length === 0 ? (
              <div className="p-12 text-center text-sm text-slate-400 dark:text-[#64916e] font-medium">No purchases this month</div>
            ) : (
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-[#142119] border-b border-slate-200 dark:border-[#2d4a35]">
                  <tr>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Product</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Shift</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Qty</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Rate</th>
                    <th className="px-5 py-3 text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {entries.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                      <td className="px-5 py-3.5 text-sm text-slate-600 dark:text-[#a7c4ae]">
                        {fmtDate(e.date, { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
                          {e.product}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-[#e2f5e8]">
                        {e.shift || '-'}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-semibold text-slate-700 dark:text-[#e2f5e8]">
                        {e.quantity.toFixed(2)} {e.unit}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-500 dark:text-[#8ba895]">Rs. {e.rate.toLocaleString()}/{e.unit}</td>
                      <td className="px-5 py-3.5 text-sm font-bold text-slate-800 dark:text-[#e2f5e8] text-right">{fmtAmount(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                {/* Footer total row */}
                <tfoot className="border-t-2 border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119]">
                  <tr>
                    <td colSpan={5} className="px-5 py-3 text-sm font-bold text-slate-700 dark:text-[#e2f5e8] text-right uppercase tracking-wider">
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
            className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8] text-lg">
                {fmtDate(detailDate.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <button
                onClick={() => setDetailDate(null)}
                className="text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] transition-colors text-lg leading-none"
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Modal body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-3">
              {SHIFTS.map(shift => (
                <div key={shift} className="space-y-3">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-[#e2f5e8]">{shift}: {shiftQuantity(detailDate.entries, shift)}</h4>
                  {detailDate.entries.filter(e => e.shift === shift).map((e, i) => (
                <div key={e.id} className="p-4 rounded-xl border border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] relative">
                  <div className="absolute -top-2.5 left-4 bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider">
                    DELIVERY {i + 1}
                  </div>
                  <div className="flex justify-between items-start mt-2">
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">{e.product}</p>
                      <p className="text-xs text-slate-500 dark:text-[#8ba895] mt-0.5">{e.time} · {e.quantity.toFixed(2)} {e.unit} × Rs. {e.rate.toLocaleString()}/{e.unit}</p>
                    </div>
                    <p className="text-base font-bold text-amber-600">{fmtAmount(e.amount)}</p>
                  </div>
                </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Modal footer: daily total */}
            <div className="px-5 py-4 border-t border-slate-200 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119] flex items-center justify-between">
              <span className="font-bold text-slate-800 dark:text-[#e2f5e8]">Daily Total</span>
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
