import React, { useState } from 'react';
import { History, Eye } from 'lucide-react';
import { Pagination } from '../common/Pagination';
import { useShiftStore } from '../../store/shiftStore';
import { ShiftRecord, ShiftDifferenceStatus } from '../../types';
import { ShiftDetailModal } from './ShiftDetailModal';
import { formatUserName } from '../../utils/userFormat';

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

const isAutoClosedShift = (s: any) => Boolean(s.isAutoClosed || (!s.closedById && s.status === "Closed") || (s.closingNotes && /auto-close|auto-closed|midnight/i.test(s.closingNotes)));

export const ShiftHistoryPanel: React.FC = () => {
  const { shifts } = useShiftStore();
  const [viewRecord, setViewRecord] = useState<ShiftRecord | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-100 dark:border-[#2d4a35] shadow-sm flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500 dark:text-[#86efac]" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] uppercase tracking-wider">Shift History</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Date</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Opened By</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Closed By</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Expected</th>
              <th className="text-right px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Diff</th>
              <th className="text-center px-4 py-3 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Status</th>
              <th className="px-4 py-3 border-b border-slate-100 dark:border-[#2d4a35]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
            {shifts
              .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
              .map((shift) => (
              <tr key={shift.id} className="hover:bg-slate-50 dark:hover:bg-[#223927] transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800 dark:text-[#e2f5e8]">{shift.date}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatUserName(shift.openedBy)}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{isAutoClosedShift(shift) ? "—" : formatUserName(shift.closedBy)}</td>
                <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">Rs. {shift.expectedCash.toLocaleString()}</td>
                <td className="px-4 py-3 text-right">
                  {shift.difference !== undefined ? (
                     <span className={`font-bold ${shift.difference < 0 ? 'text-rose-600 dark:text-rose-400' : shift.difference > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                       Rs. {shift.difference.toLocaleString()}
                     </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  {shift.status === 'Open' ? (
                    <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">OPEN</span>
                  ) : (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${diffColors[shift.differenceStatus!]}`}>
                      {shift.differenceStatus?.toUpperCase()}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setViewRecord(shift)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#2d4a35] rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-[#e2f5e8]"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {shifts.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={shifts.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
            itemLabel="shifts"
          />
        )}
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
