import React, { useState } from 'react';
import { History, Eye } from 'lucide-react';
import { useShiftStore } from '../../store/shiftStore';
import { ShiftRecord, ShiftDifferenceStatus } from '../../types';
import { ShiftDetailModal } from './ShiftDetailModal';

const diffColors: Record<ShiftDifferenceStatus, string> = {
  Balanced: 'bg-emerald-100 text-emerald-700',
  Short: 'bg-rose-100 text-rose-700',
  Over: 'bg-amber-100 text-amber-700',
};

function formatTimestamp(iso?: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

export const ShiftHistoryPanel: React.FC = () => {
  const { shifts } = useShiftStore();
  const [viewRecord, setViewRecord] = useState<ShiftRecord | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Shift History</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Date</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Opened By</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Closed By</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Expected</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Diff</th>
              <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
              <th className="px-4 py-3 border-b border-slate-100"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shifts.map((shift) => (
              <tr key={shift.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{shift.date}</td>
                <td className="px-4 py-3 text-slate-600">{shift.openedBy}</td>
                <td className="px-4 py-3 text-slate-600">{shift.closedBy || '—'}</td>
                <td className="px-4 py-3 text-right text-slate-600">Rs. {shift.expectedCash.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  {shift.difference !== undefined ? (
                     <span className={`font-bold ${shift.difference < 0 ? 'text-rose-600' : shift.difference > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                       Rs. {shift.difference.toLocaleString()}
                     </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {shift.status === 'Open' ? (
                    <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">OPEN</span>
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diffColors[shift.differenceStatus!]}`}>
                      {shift.differenceStatus?.toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setViewRecord(shift)}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewRecord && (
        <ShiftDetailModal 
          record={viewRecord} 
          onClose={() => setViewRecord(null)} 
        />
      )}
    </div>
  );
};
