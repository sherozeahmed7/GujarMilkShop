import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, Banknote } from 'lucide-react';
import { ShiftRecord, ShiftDifferenceStatus, SupplierPaymentRecord } from '../../types';
import { supplierService } from '../../services/supplier.service';

interface ShiftDetailModalProps {
  record: ShiftRecord;
  onClose: () => void;
}

const diffColors: Record<ShiftDifferenceStatus, string> = {
  Balanced: 'bg-emerald-100 text-emerald-700',
  Short: 'bg-rose-100 text-rose-700',
  Over: 'bg-amber-100 text-amber-700',
};

function formatTimestamp(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ShiftDetailModal: React.FC<ShiftDetailModalProps> = ({ record, onClose }) => {
  const [supplierPays, setSupplierPays] = useState<SupplierPaymentRecord[]>([]);
  const [loadingPays, setLoadingPays] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingPays(true);
      try {
        const rows = await supplierService.listPayments({
          shiftDate: record.date,
          method: 'cash',
        });
        if (!cancelled) setSupplierPays(rows);
      } catch {
        if (!cancelled) setSupplierPays([]);
      } finally {
        if (!cancelled) setLoadingPays(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [record.date]);

  const supplierCashTotal = supplierPays.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Shift Details</p>
            <h2 className="text-base font-bold text-slate-800 mt-0.5">{record.id}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="font-bold text-slate-700">{record.date}</span>
            </div>
            {record.status === 'Open' ? (
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-100 text-blue-700">
                OPEN SHIFT
              </span>
            ) : (
              <span
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                  diffColors[record.differenceStatus!]
                }`}
              >
                {record.differenceStatus?.toUpperCase()}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <p className="text-[11px] font-bold uppercase tracking-wider">Opened</p>
              </div>
              <p className="text-sm font-bold text-slate-800">{formatTimestamp(record.openedAt)}</p>
              <p className="text-xs text-slate-500 mt-0.5">by {record.openedBy}</p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <p className="text-[11px] font-bold uppercase tracking-wider">Closed</p>
              </div>
              <p className="text-sm font-bold text-slate-800">{formatTimestamp(record.closedAt)}</p>
              {record.closedBy && (
                <p className="text-xs text-slate-500 mt-0.5">by {record.closedBy}</p>
              )}
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">Opening Cash</span>
              <span className="font-bold text-slate-800">
                Rs. {record.openingCash.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 font-medium">Expected Cash</span>
              <span className="font-bold text-emerald-700">
                Rs. {record.expectedCash.toLocaleString()}
              </span>
            </div>
            {record.countedCash !== undefined && (
              <div className="flex justify-between items-center text-sm border-t border-slate-200 pt-3">
                <span className="text-slate-500 font-medium">Counted Cash</span>
                <span className="font-bold text-slate-800">
                  Rs. {record.countedCash.toLocaleString()}
                </span>
              </div>
            )}
            {record.difference !== undefined && (
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500 font-medium">Difference</span>
                <span
                  className={`font-bold ${
                    record.difference < 0
                      ? 'text-rose-600'
                      : record.difference > 0
                        ? 'text-amber-600'
                        : 'text-slate-400'
                  }`}
                >
                  Rs. {record.difference.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Supplier cash outs
                </p>
              </div>
              <span className="text-sm font-bold text-emerald-800">
                Rs. {supplierCashTotal.toLocaleString()}
              </span>
            </div>
            <div className="px-4 py-2 max-h-40 overflow-y-auto">
              {loadingPays ? (
                <p className="text-xs text-slate-400 py-2">Loading…</p>
              ) : supplierPays.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No supplier cash payments on this shift.</p>
              ) : (
                <ul className="divide-y divide-emerald-100/80">
                  {supplierPays.map((p) => (
                    <li
                      key={p.id}
                      className="py-2 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{p.supplierName}</p>
                        <p className="text-[11px] text-slate-500">
                          {p.date}
                          {p.notes ? ` · ${p.notes}` : ''}
                        </p>
                      </div>
                      <span className="font-bold text-slate-800 whitespace-nowrap">
                        Rs. {p.amount.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {record.openingNotes && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Opening Notes
              </p>
              <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                {record.openingNotes}
              </p>
            </div>
          )}

          {record.closingNotes && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                Closing Notes
              </p>
              <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                {record.closingNotes}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold rounded-xl transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
