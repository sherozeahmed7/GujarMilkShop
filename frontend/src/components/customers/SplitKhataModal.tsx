import React from 'react';
import { X, BookOpen, Undo2 } from 'lucide-react';
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

export const SplitKhataModal: React.FC<SplitKhataModalProps> = ({
  title,
  phone,
  sales,
  returns = [],
  mode = 'split',
  onClose,
}) => {
  const totalBill = sales.reduce((s, x) => s + x.totalAmount, 0);
  const totalPaid = sales.reduce((s, x) => s + x.paidAmount, 0);
  const totalReturned = returns.reduce((s, x) => s + (x.refundAmount || 0), 0);
  const totalRemaining = sales.reduce((s, x) => s + x.remainingBalance, 0);
  const heading = mode === 'ledger' ? 'Ledger Khata' : 'Split Khata';
  const accent =
    mode === 'ledger'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-amber-100 text-amber-700';

  const returnsByBill = new Map<string, ReturnRecord[]>();
  for (const r of returns) {
    const key = String(r.billNumber || '');
    const list = returnsByBill.get(key) || [];
    list.push(r);
    returnsByBill.set(key, list);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accent}`}>
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{heading}</h3>
              <p className="text-xs font-medium text-slate-500">
                {title}
                {phone ? ` · ${phone}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b border-slate-100">
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase">Bought</p>
            <p className="text-lg font-bold text-slate-800 mt-1">{fmt(totalBill)}</p>
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

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {sales.length === 0 && returns.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-8">No purchases found.</p>
          ) : (
            <>
              {sales.map((sale) => {
                const saleReturns = returnsByBill.get(String(sale.id)) || [];
                return (
                  <div key={sale.id} className="space-y-2">
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <span className="text-sm font-bold text-slate-800">
                            Sale #{sale.id}
                          </span>
                          <span className="text-xs text-slate-400 ml-2">
                            {new Date(sale.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            sale.status === 'partial'
                              ? 'bg-amber-100 text-amber-800'
                              : sale.status === 'paid'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {sale.status}
                        </span>
                      </div>
                      <div className="px-4 py-3">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-[10px] uppercase text-slate-400 font-bold">
                              <th className="text-left pb-2">Item</th>
                              <th className="text-right pb-2">Qty (kg)</th>
                              <th className="text-right pb-2">Rate</th>
                              <th className="text-right pb-2">Amount</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(sale.items || []).map((item) => (
                              <tr key={item.id}>
                                <td className="py-1.5 capitalize font-medium text-slate-700">
                                  {item.itemName}
                                </td>
                                <td className="py-1.5 text-right text-slate-600">
                                  {item.quantity}
                                </td>
                                <td className="py-1.5 text-right text-slate-600">
                                  {fmt(item.unitPrice)}
                                </td>
                                <td className="py-1.5 text-right font-semibold text-slate-800">
                                  {fmt(item.totalPrice)}
                                </td>
                              </tr>
                            ))}
                            {(!sale.items || sale.items.length === 0) && (
                              <tr>
                                <td colSpan={4} className="py-2 text-slate-400 text-center">
                                  {NA}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-4 text-xs">
                          <span className="text-slate-600">
                            Bill: <strong>{fmt(sale.totalAmount)}</strong>
                          </span>
                          <span className="text-emerald-700">
                            Paid: <strong>{fmt(sale.paidAmount)}</strong>
                          </span>
                          <span className="text-rose-600">
                            Remaining: <strong>{fmt(sale.remainingBalance)}</strong>
                          </span>
                        </div>
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
                                    <td className="py-1 capitalize text-violet-800">
                                      {item.name}
                                    </td>
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
                              <p className="text-[11px] text-violet-600 mt-2">
                                Reason: {ret.reason}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* Returns whose bill is no longer linked / orphan */}
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

        <div className="p-4 border-t border-slate-100 flex justify-end">
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
