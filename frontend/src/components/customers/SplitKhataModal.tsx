import React, { useMemo, useState } from 'react';
import { X, BookOpen, Undo2, ArrowDownRight, ArrowUpRight, Banknote, Percent } from 'lucide-react';
import { SaleRecord } from '../../services/sale.service';
import { ReturnRecord } from '../../types/returns';

interface SplitKhataModalProps {
  title: string;
  phone: string | null;
  sales: SaleRecord[];
  returns?: ReturnRecord[];
  mode?: 'split' | 'ledger';
  onClose: () => void;
}

const NA = 'Not Available';

function fmt(n: number) {
  return `Rs. ${Math.round(n).toLocaleString()}`;
}

type HistoryKind = 'sale' | 'payment' | 'discount' | 'return';

interface HistoryEntry {
  id: string;
  at: number;
  dateLabel: string;
  kind: HistoryKind;
  title: string;
  detail: string;
  /** Positive = increases what customer owes; negative = reduces owed */
  delta: number;
}

function methodLabel(method: string | undefined): string {
  const m = (method || '').toLowerCase();
  if (m === 'discount') return 'Discount write-off';
  if (m === 'online') return 'Online';
  if (m === 'cash') return 'Cash';
  return method ? method.replace(/_/g, ' ') : 'Payment';
}

function buildHistory(sales: SaleRecord[], returns: ReturnRecord[]): HistoryEntry[] {
  const entries: HistoryEntry[] = [];

  for (const sale of sales) {
    const saleAt = new Date(sale.createdAt).getTime();
    const itemSummary =
      (sale.items || [])
        .map((i) => `${i.itemName} ${i.quantity}kg`)
        .join(', ') || 'Sale';

    const discountOnSale = (sale.payments || [])
      .filter((p) => (p.method || '').toLowerCase() === 'discount')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    // totalAmount is reduced when discount is written off — restore original charged amount for the timeline
    const charged = sale.totalAmount + discountOnSale;

    entries.push({
      id: `sale-${sale.id}`,
      at: saleAt,
      dateLabel: new Date(sale.createdAt).toLocaleString(),
      kind: 'sale',
      title: `Sale #${sale.id}`,
      detail: itemSummary,
      delta: charged,
    });

    // If opening balance was created with total already set, still show as charged amount
    for (const pay of sale.payments || []) {
      if (!pay.amount || pay.amount <= 0) continue;
      const isDiscount = (pay.method || '').toLowerCase() === 'discount';
      const payAt = pay.createdAt ? new Date(pay.createdAt).getTime() : saleAt;
      entries.push({
        id: `pay-${pay.id}`,
        at: payAt,
        dateLabel: pay.createdAt
          ? new Date(pay.createdAt).toLocaleString()
          : new Date(sale.createdAt).toLocaleString(),
        kind: isDiscount ? 'discount' : 'payment',
        title: isDiscount ? 'Discount' : `Collected · ${methodLabel(pay.method)}`,
        detail: `Against sale #${sale.id}${pay.status ? ` · ${pay.status}` : ''}`,
        delta: -pay.amount,
      });
    }
  }

  for (const ret of returns) {
    const raw = ret.date || '';
    const at = new Date(raw).getTime();
    const safeAt = Number.isNaN(at) ? 0 : at;
    entries.push({
      id: `ret-${ret.returnId || ret.billNumber}-${raw}`,
      at: safeAt,
      dateLabel: raw || '—',
      kind: 'return',
      title: `Return · Bill #${ret.billNumber}`,
      detail: [ret.returnType, ret.reason].filter(Boolean).join(' · ') || 'Return',
      delta: -(ret.refundAmount || 0),
    });
  }

  return entries.sort((a, b) => b.at - a.at);
}

export const SplitKhataModal: React.FC<SplitKhataModalProps> = ({
  title,
  phone,
  sales,
  returns = [],
  mode = 'split',
  onClose,
}) => {
  const [tab, setTab] = useState<'bills' | 'history'>('history');

  const totalBill = sales.reduce((s, x) => s + x.totalAmount, 0);
  const totalPaid = sales.reduce((s, x) => s + x.paidAmount, 0);
  const totalReturned = returns.reduce((s, x) => s + (x.refundAmount || 0), 0);
  const totalRemaining = sales.reduce((s, x) => s + x.remainingBalance, 0);
  const heading = mode === 'ledger' ? 'Ledger Khata' : 'Split Khata';
  const accent =
    mode === 'ledger' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700';

  const history = useMemo(() => buildHistory(sales, returns), [sales, returns]);

  const returnsByBill = new Map<string, ReturnRecord[]>();
  for (const r of returns) {
    const key = String(r.billNumber || '');
    const list = returnsByBill.get(key) || [];
    list.push(r);
    returnsByBill.set(key, list);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119]/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accent}`}>
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">{heading}</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-[#8ba895]">
                {title}
                {phone ? ` · ${phone}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] hover:bg-slate-200 dark:hover:bg-[#1e3124] rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b border-slate-100 dark:border-[#2d4a35]">
          <div className="bg-slate-50 dark:bg-[#142119] rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-500 dark:text-[#8ba895] uppercase">Bought</p>
            <p className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8] mt-1">{fmt(totalBill)}</p>
          </div>
          <div className="bg-violet-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-violet-700 uppercase">Returned</p>
            <p className="text-lg font-bold text-violet-700 mt-1">{fmt(totalReturned)}</p>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-emerald-700 uppercase">Paid</p>
            <p className="text-lg font-bold text-emerald-700 mt-1">{fmt(totalPaid)}</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-rose-600 uppercase">Remaining</p>
            <p className="text-lg font-bold text-rose-600 mt-1">{fmt(totalRemaining)}</p>
          </div>
        </div>

        <div className="px-5 pt-3 flex gap-2 border-b border-slate-100 dark:border-[#2d4a35]">
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`px-3 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              tab === 'history'
                ? 'border-slate-800 text-slate-800 dark:text-[#e2f5e8]'
                : 'border-transparent text-slate-500 dark:text-[#8ba895] hover:text-slate-700 dark:hover:text-[#a7c4ae]'
            }`}
          >
            Full history
          </button>
          <button
            type="button"
            onClick={() => setTab('bills')}
            className={`px-3 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
              tab === 'bills'
                ? 'border-slate-800 text-slate-800 dark:text-[#e2f5e8]'
                : 'border-transparent text-slate-500 dark:text-[#8ba895] hover:text-slate-700 dark:hover:text-[#a7c4ae]'
            }`}
          >
            By bill
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {tab === 'history' ? (
            history.length === 0 ? (
              <p className="text-center text-slate-400 dark:text-[#64916e] text-sm py-8">No ledger activity yet.</p>
            ) : (
              <div className="border border-slate-200 dark:border-[#2d4a35] rounded-xl overflow-hidden bg-white dark:bg-[#1a2e1f]">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-[#142119] border-b border-slate-200 dark:border-[#2d4a35] sticky top-0">
                    <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500 dark:text-[#8ba895] font-bold">
                      <th className="px-3 py-2.5">When</th>
                      <th className="px-3 py-2.5">Event</th>
                      <th className="px-3 py-2.5 text-right">Charged (+)</th>
                      <th className="px-3 py-2.5 text-right">Cleared (−)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                    {history.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50/80 dark:hover:bg-[#1e3124]">
                        <td className="px-3 py-2.5 whitespace-nowrap text-xs text-slate-500 dark:text-[#8ba895] font-medium">
                          {row.dateLabel}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-start gap-2">
                            {row.kind === 'sale' && (
                              <ArrowUpRight className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                            )}
                            {row.kind === 'payment' && (
                              <Banknote className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                            )}
                            {row.kind === 'discount' && (
                              <Percent className="w-4 h-4 text-sky-500 mt-0.5 flex-shrink-0" />
                            )}
                            {row.kind === 'return' && (
                              <Undo2 className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className="font-semibold text-slate-800 dark:text-[#e2f5e8]">{row.title}</p>
                              <p className="text-xs text-slate-500 dark:text-[#8ba895] mt-0.5">{row.detail}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-800 dark:text-[#e2f5e8] tabular-nums">
                          {row.delta > 0 ? fmt(row.delta) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {row.delta < 0 ? (
                            <span
                              className={
                                row.kind === 'discount'
                                  ? 'text-sky-600'
                                  : row.kind === 'return'
                                    ? 'text-violet-600'
                                    : 'text-emerald-600'
                              }
                            >
                              {fmt(Math.abs(row.delta))}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : sales.length === 0 && returns.length === 0 ? (
            <p className="text-center text-slate-400 dark:text-[#64916e] text-sm py-8">No purchases found.</p>
          ) : (
            <>
              {sales.map((sale) => {
                const saleReturns = returnsByBill.get(String(sale.id)) || [];
                const salePayments = (sale.payments || []).filter((p) => p.amount > 0);
                return (
                  <div key={sale.id} className="space-y-2">
                    <div className="border border-slate-200 dark:border-[#2d4a35] rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 dark:bg-[#142119] flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8]">Sale #{sale.id}</span>
                          <span className="text-xs text-slate-400 dark:text-[#64916e] ml-2">
                            {new Date(sale.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            sale.status === 'partial'
                              ? 'bg-amber-100 text-amber-800'
                              : sale.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 dark:bg-[#142119] text-slate-600 dark:text-[#a7c4ae]'
                          }`}
                        >
                          {sale.status}
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[10px] uppercase text-slate-400 dark:text-[#64916e] font-bold">
                              <th className="text-left pb-2">Item</th>
                              <th className="text-right pb-2">Qty (kg)</th>
                              <th className="text-right pb-2">Rate</th>
                              <th className="text-right pb-2">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                            {(sale.items || []).map((item) => (
                              <tr key={item.id}>
                                <td className="py-1.5 capitalize font-medium text-slate-700 dark:text-[#a7c4ae]">
                                  {item.itemName}
                                </td>
                                <td className="py-1.5 text-right text-slate-600 dark:text-[#a7c4ae]">{item.quantity}</td>
                                <td className="py-1.5 text-right text-slate-600 dark:text-[#a7c4ae]">
                                  {fmt(item.unitPrice)}
                                </td>
                                <td className="py-1.5 text-right font-semibold text-slate-800 dark:text-[#e2f5e8]">
                                  {fmt(item.totalPrice)}
                                </td>
                              </tr>
                            ))}
                            {(!sale.items || sale.items.length === 0) && (
                              <tr>
                                <td colSpan={4} className="py-2 text-slate-400 dark:text-[#64916e] text-center">
                                  {NA}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#2d4a35] flex flex-wrap gap-4 text-xs">
                          <span className="text-slate-600 dark:text-[#a7c4ae]">
                            Bill: <strong>{fmt(sale.totalAmount)}</strong>
                          </span>
                          <span className="text-emerald-700">
                            Paid: <strong>{fmt(sale.paidAmount)}</strong>
                          </span>
                          <span className="text-rose-600">
                            Remaining: <strong>{fmt(sale.remainingBalance)}</strong>
                          </span>
                        </div>

                        {salePayments.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-[#2d4a35] space-y-1.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#64916e]">
                              Collections on this bill
                            </p>
                            {salePayments.map((pay) => {
                              const isDiscount = (pay.method || '').toLowerCase() === 'discount';
                              return (
                                <div
                                  key={pay.id}
                                  className="flex items-center justify-between text-xs gap-2"
                                >
                                  <span className="text-slate-600 dark:text-[#a7c4ae] flex items-center gap-1.5">
                                    {isDiscount ? (
                                      <Percent className="w-3.5 h-3.5 text-sky-500" />
                                    ) : (
                                      <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
                                    )}
                                    {isDiscount ? 'Discount' : methodLabel(pay.method)}
                                    {pay.createdAt
                                      ? ` · ${new Date(pay.createdAt).toLocaleString()}`
                                      : ''}
                                  </span>
                                  <span
                                    className={`font-bold ${isDiscount ? 'text-sky-600' : 'text-emerald-700'}`}
                                  >
                                    {fmt(pay.amount)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {saleReturns.map((ret) => (
                      <div
                        key={ret.returnId || ret.billNumber + ret.date}
                        className="border border-violet-200 bg-violet-50/40 rounded-xl overflow-hidden ml-3"
                      >
                        <div className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Undo2 className="w-3.5 h-3.5 text-violet-600" />
                            <span className="text-sm font-bold text-violet-800">
                              Return · Bill #{ret.billNumber}
                            </span>
                            <span className="text-xs text-violet-500">
                              {ret.date}
                              {ret.returnType ? ` · ${ret.returnType}` : ''}
                            </span>
                          </div>
                          <span className="text-sm font-bold text-violet-700">
                            −{fmt(ret.refundAmount)}
                          </span>
                        </div>
                        {(ret.items || []).length > 0 && (
                          <div className="px-4 pb-3">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="text-[10px] uppercase text-violet-400 font-bold">
                                  <th className="text-left pb-1">Item</th>
                                  <th className="text-right pb-1">Qty</th>
                                  <th className="text-right pb-1">Refund</th>
                                </tr>
                              </thead>
                              <tbody>
                                {ret.items.map((item, idx) => (
                                  <tr key={`${ret.returnId}-${idx}`}>
                                    <td className="py-1 capitalize text-violet-800">{item.name}</td>
                                    <td className="py-1 text-right text-violet-700">
                                      {item.returnQty}
                                    </td>
                                    <td className="py-1 text-right font-semibold text-violet-800">
                                      {fmt(item.refundAmount)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {ret.reason ? (
                              <p className="text-[11px] text-violet-600 mt-2">Reason: {ret.reason}</p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}

              {returns
                .filter((r) => !sales.some((s) => String(s.id) === String(r.billNumber)))
                .map((ret) => (
                  <div
                    key={`orphan-${ret.returnId}`}
                    className="border border-violet-200 bg-violet-50/40 rounded-xl overflow-hidden"
                  >
                    <div className="px-4 py-2.5 flex justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Undo2 className="w-3.5 h-3.5 text-violet-600" />
                        <span className="text-sm font-bold text-violet-800">
                          Return · Bill #{ret.billNumber}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-violet-700">
                        −{fmt(ret.refundAmount)}
                      </span>
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-[#2d4a35] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-xl font-semibold text-sm hover:bg-slate-900"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
