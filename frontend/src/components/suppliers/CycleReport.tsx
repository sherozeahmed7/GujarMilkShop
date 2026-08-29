import React from 'react';
import { Supplier } from '../../types';
import { useSupplierStore } from '../../store/supplierStore';
import { FileText, ArrowDownRight, ArrowUpRight, Percent, Banknote } from 'lucide-react';

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
      return {
        id: p.id,
        date: p.date,
        sortAt: p.date,
        type: (isDiscount ? 'Discount' : 'Payment') as 'Discount' | 'Payment',
        description: isDiscount
          ? `Discount write-off${p.notes ? ` — ${p.notes}` : ''}`
          : `${methodLabel(p.method)}${p.notes ? ` — ${p.notes}` : ''}`,
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
          className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors self-start"
        >
          <FileText className="w-4 h-4" />
          Export Statement
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
