import React, { useState } from 'react';
import { Supplier } from '../../types';
import { useSupplierStore } from '../../store/supplierStore';
import { savePdfDocument } from '../../utils/exportUtils';
import { FileText, ArrowDownRight, ArrowUpRight, Percent, Banknote, Loader2 } from 'lucide-react';

interface CycleReportProps {
  supplier: Supplier;
}

function methodLabel(method: string | undefined): string {
  const m = (method || 'cash').toLowerCase();
  if (m === 'discount') return 'Discount write-off';
  if (m === 'bank_transfer') return 'Bank transfer';
  if (m === 'jazzcash') return 'JazzCash';
  if (m === 'cash') return 'Cash';
  return method ? method.replace(/_/g, ' ') : 'Payment';
}

export const CycleReport: React.FC<CycleReportProps> = ({ supplier }) => {
  const { collections, payments } = useSupplierStore();
  const [isExporting, setIsExporting] = useState(false);

  const supplierCollections = collections
    .filter((c) => c.supplierId === supplier.id)
    .map((c) => ({
      id: c.id,
      date: c.date,
      sortAt: c.date,
      type: 'Collection' as const,
      description: `${c.shift} Shift — ${c.milkType} Milk (${c.quantity}kg @ Rs.${c.rate})`,
      amount: c.amount,
      method: undefined as string | undefined,
    }));

  const supplierPayments = payments
    .filter((p) => p.supplierId === supplier.id)
    .map((p) => {
      const isDiscount = (p.method || '').toLowerCase() === 'discount';
      const shiftHint =
        !isDiscount && p.shiftDate
          ? ` · Shift ${p.shiftDate}`
          : !isDiscount && p.shiftId
            ? ` · Shift #${p.shiftId}`
            : '';
      return {
        id: p.id,
        date: p.date,
        sortAt: p.date,
        type: (isDiscount ? 'Discount' : 'Payment') as 'Discount' | 'Payment',
        description: isDiscount
          ? `Discount write-off${p.notes ? ` — ${p.notes}` : ''}`
          : `${methodLabel(p.method)}${shiftHint}${p.notes ? ` — ${p.notes}` : ''}`,
        amount: -p.amount,
        method: p.method,
      };
    });

  const advanceEntry =
    supplier.guaranteedAdvance > 0
      ? [
          {
            id: 'advance',
            date: '',
            sortAt: '',
            type: 'Advance' as const,
            description: 'Guaranteed advance (reduces payable)',
            amount: -supplier.guaranteedAdvance,
            method: undefined as string | undefined,
          },
        ]
      : [];

  const ledger = [...supplierCollections, ...supplierPayments, ...advanceEntry].sort((a, b) => {
    if (!a.sortAt) return -1;
    if (!b.sortAt) return 1;
    return new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime();
  });

  const totalPurchases = supplierCollections.reduce((s, e) => s + e.amount, 0);
  const totalPaid = supplierPayments
    .filter((p) => p.type === 'Payment')
    .reduce((s, e) => s + Math.abs(e.amount), 0);
  const totalDiscount = supplierPayments
    .filter((p) => p.type === 'Discount')
    .reduce((s, e) => s + Math.abs(e.amount), 0);

  const handleExportStatement = async () => {
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      // Title & Brand Header
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 101, 52); // Emerald #166534
      doc.text('GUJAR MILK SHOP', 14, 16);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Supplier Complete Ledger Statement', 14, 22);

      doc.setFontSize(9);
      doc.text(`Generated: ${dateStr}`, 196, 22, { align: 'right' });

      // Supplier Details Box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 26, 182, 22, 2, 2, 'FD');

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text('Supplier Name:', 18, 32);
      doc.text('Supplier Code:', 18, 38);
      doc.text('Phone:', 18, 44);

      doc.text('Payment Cycle:', 110, 32);
      doc.text('Guaranteed Advance:', 110, 38);
      doc.text('Account Status:', 110, 44);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(supplier.name || '—', 48, 32);
      doc.text(supplier.code || '—', 48, 38);
      doc.text(supplier.phone || '—', 48, 44);

      doc.text(supplier.cycleType || 'Monthly Cycle', 150, 32);
      doc.text(`Rs. ${(supplier.guaranteedAdvance || 0).toLocaleString()}`, 150, 38);
      doc.text(supplier.isActive ? 'Active' : 'Inactive', 150, 44);

      // Financial Summary Box
      const remainingLabel = supplier.payableBalance < 0
        ? `Rs. −${Math.abs(Math.round(supplier.payableBalance)).toLocaleString()} (Credit)`
        : `Rs. ${Math.round(supplier.payableBalance).toLocaleString()}`;

      const summaryData = [
        [
          `Purchases: Rs. ${Math.round(totalPurchases).toLocaleString()}`,
          `Paid: Rs. ${Math.round(totalPaid).toLocaleString()}`,
          `Discount: Rs. ${Math.round(totalDiscount).toLocaleString()}`,
          `Remaining: ${remainingLabel}`
        ]
      ];

      autoTable(doc, {
        body: summaryData,
        startY: 52,
        styles: { fontSize: 8.5, fontStyle: 'bold', cellPadding: 3, halign: 'center' },
        columnStyles: {
          0: { textColor: [180, 83, 9], fillColor: [254, 243, 199] },
          1: { textColor: [4, 120, 87], fillColor: [209, 250, 229] },
          2: { textColor: [3, 105, 161], fillColor: [224, 242, 254] },
          3: { textColor: [15, 23, 42], fillColor: [241, 245, 249] },
        },
        theme: 'grid',
      });

      const nextY = (doc as any).lastAutoTable?.finalY + 8 || 70;

      // Table of ledger entries
      const tableRows = ledger.map((entry) => [
        entry.date ? new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
        entry.description,
        entry.type,
        entry.amount > 0 ? `Rs. ${entry.amount.toLocaleString()}` : '—',
        entry.amount < 0 ? `Rs. ${Math.abs(entry.amount).toLocaleString()}` : '—',
      ]);

      autoTable(doc, {
        head: [['Date', 'Event Description', 'Type', 'Purchase (+)', 'Cleared (−)']],
        body: tableRows,
        startY: nextY,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 26 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 24, fontStyle: 'bold' },
          3: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: [180, 83, 9] },
          4: { cellWidth: 30, halign: 'right', fontStyle: 'bold', textColor: [4, 120, 87] },
        },
        theme: 'striped',
      });

      const safeName = (supplier.name || 'supplier').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Supplier_Statement_${supplier.code || 'SUP'}_${safeName}_${now.toISOString().slice(0, 10)}.pdf`;

      await savePdfDocument(doc, filename);
    } catch (err) {
      console.error('[Export Statement] PDF generation error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
        <div>
          <h3 className="text-lg font-bold text-slate-800">Full ledger history</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Every purchase, payment, and discount for this supplier
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportStatement}
          disabled={isExporting}
          className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-60 px-3.5 py-2 rounded-xl transition-all shadow-2xs self-start"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          <span>{isExporting ? 'Exporting PDF…' : 'Export Statement'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
          <p className="text-[10px] font-bold uppercase text-amber-700/80">Purchases</p>
          <p className="text-sm font-bold text-amber-800 tabular-nums">
            Rs. {Math.round(totalPurchases).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2">
          <p className="text-[10px] font-bold uppercase text-emerald-700/80">Paid</p>
          <p className="text-sm font-bold text-emerald-800 tabular-nums">
            Rs. {Math.round(totalPaid).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-sky-50 border border-sky-100 px-3 py-2">
          <p className="text-[10px] font-bold uppercase text-sky-700/80">Discount</p>
          <p className="text-sm font-bold text-sky-800 tabular-nums">
            Rs. {Math.round(totalDiscount).toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-[10px] font-bold uppercase text-slate-500">Remaining</p>
          <p
            className={`text-sm font-bold tabular-nums ${supplier.payableBalance < 0 ? 'text-emerald-700' : 'text-slate-800'}`}
          >
            {supplier.payableBalance < 0
              ? `Rs. −${Math.abs(Math.round(supplier.payableBalance)).toLocaleString()}`
              : `Rs. ${Math.round(supplier.payableBalance).toLocaleString()}`}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-sm custom-scrollbar">
        {ledger.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No entries found for this supplier.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3 text-right">Purchase (+)</th>
                <th className="px-4 py-3 text-right">Cleared (−)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((entry) => (
                <tr key={`${entry.type}-${entry.id}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                    {entry.date
                      ? new Date(entry.date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    <div className="flex items-center gap-2">
                      {entry.type === 'Collection' ? (
                        <ArrowUpRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      ) : entry.type === 'Discount' ? (
                        <Percent className="w-4 h-4 text-sky-500 flex-shrink-0" />
                      ) : entry.type === 'Advance' ? (
                        <Banknote className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      )}
                      <div>
                        <span className="font-medium">{entry.description}</span>
                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {entry.type}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700 tabular-nums">
                    {entry.amount > 0 ? `Rs. ${entry.amount.toLocaleString()}` : '—'}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-medium tabular-nums ${
                      entry.type === 'Discount' ? 'text-sky-600' : 'text-emerald-600'
                    }`}
                  >
                    {entry.amount < 0
                      ? `Rs. ${Math.abs(entry.amount).toLocaleString()}`
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
