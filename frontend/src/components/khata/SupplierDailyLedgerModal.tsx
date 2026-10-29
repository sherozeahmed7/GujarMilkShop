import React, { useEffect, useMemo, useState } from 'react';
import { X, Download, Calendar } from 'lucide-react';
import { Supplier, MilkCollection, SupplierPayment } from '../../types';
import { supplierService } from '../../services/supplier.service';
import { savePdfDocument } from '../../utils/exportUtils';

interface SupplierDailyLedgerModalProps {
  onClose: () => void;
}

interface DayRow {
  supplierId: string;
  supplierName: string;
  morningQty: number;
  eveningQty: number;
  totalQty: number;
  /** Effective Rs/kg for this day's deliveries (weighted if rates differ) */
  ratePerKg: number;
  dayTotal: number;
  previousBalance: number;
  paidAmount: number;
  remainingBalance: number;
  weightedRateSum: number;
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtKg(n: number) {
  if (!n) return '—';
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} kg`;
}

function fmtRs(n: number) {
  if (n < 0) return `Rs. −${Math.abs(Math.round(n)).toLocaleString()}`;
  if (n === 0) return 'Rs. 0';
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

function fmtRate(n: number) {
  if (!n) return '—';
  return `Rs. ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}/kg`;
}

function buildRows(
  suppliers: Supplier[],
  collections: MilkCollection[],
  payments: SupplierPayment[],
  startDate: string,
  endDate: string
): DayRow[] {
  const rangeCols = collections.filter((c) => c.date >= startDate && c.date <= endDate);
  const rangePays = payments.filter((p) => p.date >= startDate && p.date <= endDate);

  return suppliers
    .map((supplier) => {
      const mine = rangeCols.filter((c) => c.supplierId === supplier.id);
      const myPayments = rangePays.filter((p) => p.supplierId === supplier.id);

      const morning = mine.filter((c) => c.shift === 'Morning');
      const evening = mine.filter((c) => c.shift === 'Evening');

      const morningQty = morning.reduce((s, c) => s + c.quantity, 0);
      const eveningQty = evening.reduce((s, c) => s + c.quantity, 0);
      const dayTotal =
        morning.reduce((s, c) => s + c.amount, 0) +
        evening.reduce((s, c) => s + c.amount, 0);
      const totalQty = morningQty + eveningQty;
      const weightedRateSum = mine.reduce((s, c) => s + c.quantity * c.rate, 0);
      const ratePerKg =
        totalQty > 0
          ? weightedRateSum / totalQty
          : supplier.defaultRate || 0;

      // Filtered range paid amount: strictly payments within the filtered date range
      const rangePaid = myPayments.reduce((s, p) => s + (p.amount || 0), 0);

      return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        morningQty,
        eveningQty,
        totalQty,
        ratePerKg,
        dayTotal,
        previousBalance: supplier.previousAmount ?? 0,
        paidAmount: rangePaid,
        remainingBalance: supplier.remainingBalance ?? supplier.payableBalance ?? 0,
        weightedRateSum,
      };
    })
    .filter((row) => row.totalQty > 0 || row.dayTotal > 0 || row.paidAmount > 0)
    .sort((a, b) => a.supplierName.localeCompare(b.supplierName));
}

export const SupplierDailyLedgerModal: React.FC<SupplierDailyLedgerModalProps> = ({
  onClose,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('Today');
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [collections, setCollections] = useState<MilkCollection[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyPreset = (preset: string) => {
    setSelectedPreset(preset);
    const d = new Date();
    const toYMD = (dt: Date) => {
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    if (preset === 'Today') {
      const s = toYMD(d);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === 'Yesterday') {
      d.setDate(d.getDate() - 1);
      const s = toYMD(d);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === '7 Days') {
      const end = toYMD(d);
      d.setDate(d.getDate() - 6);
      const start = toYMD(d);
      setStartDate(start);
      setEndDate(end);
    } else if (preset === '1 Month') {
      const end = toYMD(d);
      d.setDate(d.getDate() - 29);
      const start = toYMD(d);
      setStartDate(start);
      setEndDate(end);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const list = await supplierService.list();
        const entries = await Promise.all(list.map((s) => supplierService.entries(s.id)));
        if (cancelled) return;
        setSuppliers(list);
        setCollections(entries.flatMap((e) => e.collections));
        setPayments(entries.flatMap((e) => e.payments));
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load supplier ledgers');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(
    () => buildRows(suppliers, collections, payments, startDate, endDate),
    [suppliers, collections, payments, startDate, endDate]
  );

  const totals = useMemo(() => {
    const morningQty = rows.reduce((s, r) => s + r.morningQty, 0);
    const eveningQty = rows.reduce((s, r) => s + r.eveningQty, 0);
    const totalQty = rows.reduce((s, r) => s + r.totalQty, 0);
    const dayTotal = rows.reduce((s, r) => s + r.dayTotal, 0);
    const previousBalance = rows.reduce((s, r) => s + r.previousBalance, 0);
    const paidAmount = rows.reduce((s, r) => s + r.paidAmount, 0);
    const remainingBalance = rows.reduce((s, r) => s + r.remainingBalance, 0);
    const weightedRateSum = rows.reduce((s, r) => s + r.weightedRateSum, 0);
    const avgRate = totalQty > 0 ? weightedRateSum / totalQty : 0;
    return {
      morningQty,
      eveningQty,
      totalQty,
      dayTotal,
      previousBalance,
      paidAmount,
      remainingBalance,
      avgRate,
    };
  }, [rows]);

  const handleDownloadPdf = async () => {
    if (rows.length === 0) return;
    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const rangeLabel = startDate === endDate ? startDate : `${startDate} to ${endDate}`;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    doc.setFontSize(14);
    doc.text('Supplier Ledger Report', 14, 14);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Period: ${rangeLabel} (${selectedPreset})`, 14, 21);
    doc.setTextColor(0);

    const body = rows.map((r) => [
      r.supplierName,
      r.morningQty ? r.morningQty.toFixed(2) : '—',
      r.eveningQty ? r.eveningQty.toFixed(2) : '—',
      r.totalQty ? r.totalQty.toFixed(2) : '—',
      r.ratePerKg ? r.ratePerKg.toFixed(2) : '—',
      Math.round(r.dayTotal).toLocaleString(),
      Math.round(r.previousBalance).toLocaleString(),
      Math.round(r.paidAmount).toLocaleString(),
      Math.round(r.remainingBalance).toLocaleString(),
    ]);

    body.push([
      'TOTAL',
      totals.morningQty ? totals.morningQty.toFixed(2) : '—',
      totals.eveningQty ? totals.eveningQty.toFixed(2) : '—',
      totals.totalQty ? totals.totalQty.toFixed(2) : '—',
      totals.avgRate ? totals.avgRate.toFixed(2) : '—',
      Math.round(totals.dayTotal).toLocaleString(),
      Math.round(totals.previousBalance).toLocaleString(),
      Math.round(totals.paidAmount).toLocaleString(),
      Math.round(totals.remainingBalance).toLocaleString(),
    ]);

    autoTable(doc, {
      startY: 26,
      head: [
        [
          'Supplier',
          'Morning Qty',
          'Evening Qty',
          'Total Qty',
          'Rate',
          'Total Amount',
          'Previous',
          `Paid (${selectedPreset})`,
          'Remaining',
        ],
      ],
      body,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [51, 65, 85], textColor: 255 },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === body.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [241, 245, 249];
        }
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? 40;
    doc.setFontSize(9);
    doc.text(
      `Avg rate (weighted): Rs. ${totals.avgRate.toFixed(2)}/kg  ·  Σ(qty×rate)/Σ(qty)  ·  Paid represents payments strictly within ${rangeLabel}`,
      14,
      finalY + 8
    );

    await savePdfDocument(doc, `supplier-ledger-${startDate}-to-${endDate}.pdf`);
  };

  const rangeLabel = startDate === endDate ? startDate : `${startDate} to ${endDate}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35]">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Download Supplier Ledgers</h2>
            <p className="text-xs text-slate-500 dark:text-[#8ba895] mt-0.5">
              Milk purchases, rates, and period-filtered paid amounts for {rangeLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Range Presets */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#142119] p-1 rounded-xl">
              {['Today', 'Yesterday', '7 Days', '1 Month'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                    selectedPreset === p
                      ? 'bg-white dark:bg-[#223927] text-blue-700 dark:text-[#22c55e] shadow-sm'
                      : 'text-slate-600 dark:text-[#8ba895] hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Custom Dates */}
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl px-3 py-1.5">
              <Calendar className="w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setSelectedPreset('Custom');
                }}
                className="bg-transparent border-none text-xs font-semibold text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-0 p-0"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setSelectedPreset('Custom');
                }}
                className="bg-transparent border-none text-xs font-semibold text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-0 p-0"
              />
            </div>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={loading || rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-[#223927] rounded-lg"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar p-4">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              Loading supplier collections & payments…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-medium">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-400">
              No milk collections or payments for {rangeLabel}.
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-[#2d4a35] rounded-xl overflow-hidden bg-white dark:bg-[#1a2e1f] shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-[#142119] border-b border-slate-200 dark:border-[#2d4a35] sticky top-0 z-10">
                  <tr className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-[#8ba895] font-bold">
                    <th className="px-3 py-3">Supplier</th>
                    <th className="px-3 py-3 text-right">Morning Qty</th>
                    <th className="px-3 py-3 text-right">Evening Qty</th>
                    <th className="px-3 py-3 text-right">Total Qty</th>
                    <th className="px-3 py-3 text-right">Rate</th>
                    <th className="px-3 py-3 text-right">Total Amount</th>
                    <th className="px-3 py-3 text-right">Previous Balance</th>
                    <th className="px-3 py-3 text-right bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400">
                      Paid ({selectedPreset})
                    </th>
                    <th className="px-3 py-3 text-right">Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {rows.map((row) => (
                    <tr key={row.supplierId} className="hover:bg-slate-50/80 dark:hover:bg-[#223927]/60">
                      <td className="px-3 py-2.5 font-semibold text-slate-800 dark:text-[#e2f5e8]">
                        {row.supplierName}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {fmtKg(row.morningQty)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {fmtKg(row.eveningQty)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800 dark:text-[#e2f5e8]">
                        {fmtKg(row.totalQty)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                        {fmtRate(row.ratePerKg)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-bold text-slate-900 dark:text-white">
                        {fmtRs(row.dayTotal)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                        {fmtRs(row.previousBalance)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold bg-emerald-50/40 dark:bg-emerald-950/10">
                        {row.paidAmount > 0 ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-bold">
                            {fmtRs(row.paidAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">Rs. 0</span>
                        )}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right tabular-nums font-bold ${
                          row.remainingBalance < 0
                            ? 'text-emerald-600'
                            : row.remainingBalance > 0
                              ? 'text-amber-600'
                              : 'text-slate-400'
                        }`}
                      >
                        {fmtRs(row.remainingBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-100 dark:bg-[#142119] border-t-2 border-slate-300 dark:border-[#2d4a35]">
                  <tr className="text-xs font-bold text-slate-800 dark:text-[#e2f5e8]">
                    <td className="px-3 py-3.5">Sum</td>
                    <td className="px-3 py-3.5 text-right tabular-nums">
                      {fmtKg(totals.morningQty)}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums">
                      {fmtKg(totals.eveningQty)}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums">
                      {fmtKg(totals.totalQty)}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-slate-600 dark:text-slate-400">
                      {fmtRate(totals.avgRate)}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-slate-900 dark:text-white">
                      {fmtRs(totals.dayTotal)}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums">
                      {fmtRs(totals.previousBalance)}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-950/30 font-bold">
                      {fmtRs(totals.paidAmount)}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-amber-700 dark:text-amber-400">
                      {fmtRs(totals.remainingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-100 dark:border-[#2d4a35] bg-slate-50/80 dark:bg-[#142119] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba895]">
              Average milk rate (weighted by kg)
            </p>
            <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums mt-0.5">
              {totals.totalQty > 0
                ? `Rs. ${totals.avgRate.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                    minimumFractionDigits: 2,
                  })} / kg`
                : '—'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-[#8ba895] mt-1 max-w-xl">
              Formula: Σ(quantity × rate) ÷ Σ(quantity) for {rangeLabel}. Paid column displays strictly payments recorded within this filtered date range.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 dark:bg-[#223927] dark:hover:bg-[#2d4a35] text-white rounded-xl text-sm font-semibold self-start sm:self-auto transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

