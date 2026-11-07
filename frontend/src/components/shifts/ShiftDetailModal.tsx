import React, { useEffect, useState } from 'react';
import {
  X,
  Calendar,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
  Scale,
  FileText,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Truck,
  Briefcase
} from 'lucide-react';
import { ShiftRecord, ShiftDifferenceStatus, ShiftLedgerResponse } from '../../types';
import { shiftService } from '../../services/shift.service';
import { formatUserName } from '../../utils/userFormat';

interface ShiftDetailModalProps {
  record: ShiftRecord;
  onClose: () => void;
}

const diffColors: Record<ShiftDifferenceStatus, string> = {
  Balanced: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
  Short: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
  Over: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300',
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

function formatTimeOnly(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

const isAutoClosedShift = (s: any) => Boolean(s.isAutoClosed || (!s.closedById && s.status === "Closed") || (s.closingNotes && /auto-close|auto-closed|midnight/i.test(s.closingNotes)));

export const ShiftDetailModal: React.FC<ShiftDetailModalProps> = ({ record, onClose }) => {
  const [ledgerData, setLedgerData] = useState<ShiftLedgerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');

  const shiftNumericId = parseInt(record.id.replace('SHIFT-', ''), 10);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!isNaN(shiftNumericId) && shiftNumericId > 0) {
          const res = await shiftService.getShiftLedger(shiftNumericId);
          if (!cancelled && res) {
            setLedgerData(res);
          }
        }
      } catch (err) {
        console.error('Failed to load shift ledger:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shiftNumericId]);

  const summary = ledgerData?.summary;
  const ledgerItems = (ledgerData?.ledger || []).filter((item) => {
    if (filterType === 'IN') return item.flowType === 'CASH_IN';
    if (filterType === 'OUT') return item.flowType === 'CASH_OUT';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="relative bg-white dark:bg-[#142119] rounded-2xl shadow-2xl border border-slate-200 dark:border-[#2d4a35] w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0 bg-slate-50/50 dark:bg-[#1a2e1f]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-[#e2f5e8]">
                  Shift Cash Ledger · {record.id}
                </h2>
                {record.status === 'Open' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 uppercase tracking-wider">
                    CURRENT OPEN SHIFT
                  </span>
                ) : (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${diffColors[record.differenceStatus || 'Balanced']
                      }`}
                  >
                    {record.differenceStatus?.toUpperCase() || 'BALANCED'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" />
                <span>Date: <strong className="text-slate-700 dark:text-slate-200">{record.date}</strong></span>
                <span>·</span>
                <span>Opened by <strong className="text-slate-700 dark:text-slate-200">{formatUserName(record.openedBy)}</strong></span>
                {record.status === 'Closed' && (
                  <>
                    <span>·</span>
                    <span>
                      Closed by{' '}
                      <strong className="text-slate-700 dark:text-slate-200">
                        {isAutoClosedShift(record) ? "—" : formatUserName(record.closedBy)}
                      </strong>
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-[#2d4a35] rounded-xl transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-[#e2f5e8]"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
          {/* Top Breakdown Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Opening Cash */}
            <div className="bg-slate-50 dark:bg-[#1a2e1f] rounded-xl p-3 border border-slate-200/80 dark:border-[#2d4a35]">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Opening Cash</span>
                <Wallet className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <p className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">
                Rs. {(summary ? summary.openingCash : record.openingCash).toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">Initial cash drawer</p>
            </div>

            {/* Total Cash Inflows */}
            <div className="bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl p-3 border border-emerald-200/80 dark:border-emerald-800/40">
              <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Cash In</span>
                <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                +Rs. {(summary ? (summary.walkInCashSales + summary.customerKhataPayments) : record.expectedCash - record.openingCash).toLocaleString()}
              </p>
              <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400 mt-0.5">
                Sales & Khata collections
              </p>
            </div>

            {/* Total Cash Outflows */}
            <div className="bg-rose-50/60 dark:bg-rose-950/20 rounded-xl p-3 border border-rose-200/80 dark:border-rose-800/40">
              <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Total Cash Out</span>
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-lg font-bold text-rose-700 dark:text-rose-300">
                -Rs. {(summary ? summary.totalCashOut : 0).toLocaleString()}
              </p>
              <p className="text-[10px] text-rose-600/80 dark:text-rose-400 mt-0.5">
                Suppliers & Shop expenses
              </p>
            </div>

            {/* Expected Cash in Drawer */}
            <div className="bg-blue-50/60 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-200/80 dark:border-blue-800/40">
              <div className="flex items-center justify-between text-blue-700 dark:text-blue-400 mb-1">
                <span className="text-[11px] font-bold uppercase tracking-wider">Expected Cash</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <p className="text-lg font-bold text-blue-800 dark:text-blue-200">
                Rs. {record.expectedCash.toLocaleString()}
              </p>
              <p className="text-[10px] text-blue-600/80 dark:text-blue-400 mt-0.5">
                Opening + In − Out
              </p>
            </div>
          </div>

          {/* Breakdown Pills: Walk-in vs Khata vs Supplier vs Expense */}
          {summary && (
            <div className="bg-slate-50 dark:bg-[#1a2e1f] rounded-xl p-3 border border-slate-200/80 dark:border-[#2d4a35] grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-[#142119] border border-slate-100 dark:border-[#2d4a35]">
                <Receipt className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Walk-in Sales</p>
                  <p className="font-bold text-slate-800 dark:text-emerald-400 truncate">Rs. {summary.walkInCashSales.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-[#142119] border border-slate-100 dark:border-[#2d4a35]">
                <FileText className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Customer Khata</p>
                  <p className="font-bold text-slate-800 dark:text-teal-400 truncate">Rs. {summary.customerKhataPayments.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-[#142119] border border-slate-100 dark:border-[#2d4a35]">
                <Truck className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Supplier Payments</p>
                  <p className="font-bold text-slate-800 dark:text-rose-400 truncate">-Rs. {summary.supplierCashOut.toLocaleString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-1.5 rounded-lg bg-white dark:bg-[#142119] border border-slate-100 dark:border-[#2d4a35]">
                <Briefcase className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">Shop Expenses</p>
                  <p className="font-bold text-slate-800 dark:text-rose-400 truncate">-Rs. {summary.expenseCashOut.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )}

          {/* Chronological Mini-Statement Ledger Table */}
          <div className="rounded-xl border border-slate-200 dark:border-[#2d4a35] overflow-hidden bg-white dark:bg-[#1a2e1f]">
            <div className="px-4 py-3 bg-slate-50 dark:bg-[#142119] border-b border-slate-200 dark:border-[#2d4a35] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-slate-600 dark:text-[#86efac]" />
                <h3 className="text-xs font-bold text-slate-800 dark:text-[#e2f5e8] uppercase tracking-wider">
                  Detailed Cash Statement (Chronological)
                </h3>
                <span className="text-[11px] font-semibold text-slate-400 px-2 py-0.5 rounded-md bg-slate-200/60 dark:bg-[#223927]">
                  {ledgerItems.length} transactions
                </span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#1a2e1f] p-1 rounded-lg border border-slate-200 dark:border-[#2d4a35] text-xs">
                <button
                  onClick={() => setFilterType('ALL')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${filterType === 'ALL'
                      ? 'bg-slate-800 dark:bg-[#22c55e] text-white dark:text-[#0d1a10] shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                >
                  All ({ledgerData?.ledger?.length || 0})
                </button>
                <button
                  onClick={() => setFilterType('IN')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${filterType === 'IN'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-700 dark:text-emerald-400 hover:text-emerald-800'
                    }`}
                >
                  Cash In
                </button>
                <button
                  onClick={() => setFilterType('OUT')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${filterType === 'OUT'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-rose-700 dark:text-rose-400 hover:text-rose-800'
                    }`}
                >
                  Cash Out
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading shift ledger statement...</div>
              ) : ledgerItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">No cash transactions recorded for this filter.</div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/80 dark:bg-[#142119] text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 sticky top-0 z-10 border-b border-slate-100 dark:border-[#2d4a35]">
                    <tr>
                      <th className="px-3 py-2.5">Time</th>
                      <th className="px-3 py-2.5">Type & Category</th>
                      <th className="px-3 py-2.5">Description / Party</th>
                      <th className="px-3 py-2.5 text-right text-emerald-700 dark:text-emerald-400">Cash In (+)</th>
                      <th className="px-3 py-2.5 text-right text-rose-700 dark:text-rose-400">Cash Out (−)</th>
                      <th className="px-3 py-2.5 text-right font-bold text-slate-800 dark:text-[#e2f5e8]">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                    {ledgerItems.map((item) => {
                      const isIn = item.flowType === 'CASH_IN';
                      const isOpening = item.category === 'Opening Cash';
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-[#223927] transition-colors ${isOpening ? 'bg-slate-50/40 dark:bg-slate-900/20 font-medium' : ''
                            }`}
                        >
                          <td className="px-3 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                            {formatTimeOnly(item.timestamp)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${isOpening
                                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  : isIn
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                    : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                                }`}
                            >
                              {isIn ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
                              {item.category}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 dark:text-slate-300">
                            <div className="font-semibold truncate max-w-[220px]">{item.party}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-400 truncate max-w-[220px]">{item.description}</div>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {item.cashIn > 0 ? `+Rs. ${item.cashIn.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                            {item.cashOut > 0 ? `-Rs. ${item.cashOut.toLocaleString()}` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-slate-900 dark:text-[#e2f5e8] whitespace-nowrap">
                            Rs. {item.runningBalance.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Reconciliation Footer in Table */}
            {summary && (
              <div className="px-4 py-3 bg-slate-50 dark:bg-[#142119] border-t border-slate-200 dark:border-[#2d4a35] flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-slate-700 dark:text-[#e2f5e8]">
                    Reconciliation Status:
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    Calculated Drawer Cash = Rs. {record.expectedCash.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-slate-600 dark:text-slate-300">
                  <span>Counted: <strong className="text-slate-900 dark:text-[#e2f5e8]">Rs. {(record.countedCash !== undefined ? record.countedCash : record.expectedCash).toLocaleString()}</strong></span>
                  <span>Difference: <strong className={record.difference && record.difference < 0 ? 'text-rose-600' : record.difference && record.difference > 0 ? 'text-amber-600' : 'text-emerald-600'}>Rs. {(record.difference || 0).toLocaleString()}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Notes Section if any */}
          {(record.openingNotes || record.closingNotes) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {record.openingNotes && (
                <div className="bg-slate-50 dark:bg-[#1a2e1f] p-3 rounded-xl border border-slate-200 dark:border-[#2d4a35]">
                  <p className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 text-[10px]">Opening Notes</p>
                  <p className="text-slate-700 dark:text-slate-300">{record.openingNotes}</p>
                </div>
              )}
              {record.closingNotes && (
                <div className="bg-slate-50 dark:bg-[#1a2e1f] p-3 rounded-xl border border-slate-200 dark:border-[#2d4a35]">
                  <p className="font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 text-[10px]">Closing Notes</p>
                  <p className="text-slate-700 dark:text-slate-300">{record.closingNotes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-[#2d4a35] flex items-center justify-between flex-shrink-0 bg-slate-50/50 dark:bg-[#1a2e1f]">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>Shift duration: {formatTimestamp(record.openedAt)} → {record.closedAt ? formatTimestamp(record.closedAt) : 'Currently active'}</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 dark:bg-[#22c55e] hover:bg-slate-900 dark:hover:bg-[#1ea34d] text-white dark:text-[#0d1a10] text-sm font-bold rounded-xl transition-all shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
