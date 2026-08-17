import React, { useState } from 'react';
import { History, Eye, Printer, ChevronDown } from 'lucide-react';
import { ReturnRecord, ReturnType } from '../../types';
import { useReturnsStore } from '../../store/returnsStore';
import { ReturnDetailModal } from './ReturnDetailModal';
import { PrintReceiptModal } from './PrintReceiptModal';

const returnTypeColors: Record<ReturnType, string> = {
  'Full Return': 'bg-rose-100 text-rose-700',
  'Partial Return': 'bg-amber-100 text-amber-700',
  'Correction': 'bg-blue-100 text-blue-700',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface RecentReturnsPanelProps {
  highlightLatest?: boolean;
}

export const RecentReturnsPanel: React.FC<RecentReturnsPanelProps> = ({ highlightLatest }) => {
  const { returns } = useReturnsStore();
  const [viewRecord, setViewRecord] = useState<ReturnRecord | null>(null);
  const [printRecord, setPrintRecord] = useState<ReturnRecord | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden h-full">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Recent Returns</h2>
        </div>
        <span className="text-xs text-slate-400 font-medium">{returns.length} record{returns.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-50">
        {returns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center px-5">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <History className="w-5 h-5 text-slate-300" />
            </div>
            <p className="text-slate-500 text-sm font-medium">No returns yet</p>
            <p className="text-slate-400 text-xs mt-1">Confirmed returns will appear here.</p>
          </div>
        )}

        {returns.map((record, idx) => {
          const isNew = highlightLatest && idx === 0;
          return (
            <div
              key={record.returnId}
              className={`px-4 py-3.5 transition-colors hover:bg-slate-50 ${isNew ? 'bg-emerald-50 border-l-4 border-emerald-400' : ''}`}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-800 truncate">{record.returnId}</span>
                    {isNew && (
                      <span className="text-[10px] font-bold bg-emerald-500 text-white px-1.5 py-0.5 rounded-full flex-shrink-0">NEW</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {record.billNumber} · {record.customer}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    id={`view-return-${record.returnId}`}
                    onClick={() => setViewRecord(record)}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                    title="View Details"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                  <button
                    id={`print-return-${record.returnId}`}
                    onClick={() => setPrintRecord(record)}
                    className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors text-slate-400 hover:text-blue-600"
                    title="Print Receipt"
                  >
                    <Printer className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Tags row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${returnTypeColors[record.returnType]}`}>
                  {record.returnType}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {record.paymentMethod}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  {record.status}
                </span>
              </div>

              {/* Amount + date */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-base font-bold text-emerald-700">Rs. {record.refundAmount.toLocaleString()}</span>
                <span className="text-[11px] text-slate-400">{formatDate(record.date)}</span>
              </div>

              {/* Reason snippet */}
              {record.reason && (
                <p className="text-[11px] text-slate-400 mt-1 italic truncate">"{record.reason}"</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {viewRecord && (
        <ReturnDetailModal
          record={viewRecord}
          onClose={() => setViewRecord(null)}
          onPrint={() => { setPrintRecord(viewRecord); setViewRecord(null); }}
        />
      )}
      {printRecord && (
        <PrintReceiptModal
          record={printRecord}
          onClose={() => setPrintRecord(null)}
        />
      )}
    </div>
  );
};
