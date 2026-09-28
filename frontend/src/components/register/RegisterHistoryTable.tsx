import React, { useState } from 'react';
import { TrendingUp, Eye } from 'lucide-react';
import { useRegisterStore } from '../../store/registerStore';
import { DifferenceStatus, RegisterData } from '../../types';
import { ZReportDetailModal } from './ZReportDetailModal';

const diffColors: Record<DifferenceStatus, string> = {
  Balanced: 'bg-emerald-100 text-emerald-700',
  Short: 'bg-rose-100 text-rose-700',
  Over: 'bg-amber-100 text-amber-700',
};

export const RegisterHistoryTable: React.FC = () => {
  const { registerHistory } = useRegisterStore();
  const [viewRecord, setViewRecord] = useState<RegisterData | null>(null);

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-100 dark:border-[#2d4a35] shadow-sm flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex items-center gap-2 bg-slate-50 dark:bg-[#142119]">
        <TrendingUp className="w-4 h-4 text-slate-500 dark:text-[#86efac]" />
        <h2 className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] uppercase tracking-wider">Register History</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-[#142119]">
            <tr>
              <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Date</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Opening</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Cash In (Sales)</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Cash Out (Exp)</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Expected</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Actual</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Variance</th>
              <th className="text-center px-5 py-4 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-100 dark:border-[#2d4a35]">Status</th>
              <th className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35]"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
            {registerHistory.map((reg) => (
              <tr key={reg.id} className="hover:bg-slate-50 dark:hover:bg-[#223927] transition-colors">
                <td className="px-5 py-4 font-bold text-slate-800 dark:text-[#e2f5e8]">{reg.date}</td>
                <td className="px-5 py-4 text-right text-slate-600 dark:text-slate-300 font-mono">{reg.openingBalance.toLocaleString()}</td>
                <td className="px-5 py-4 text-right text-emerald-600 dark:text-emerald-400 font-mono font-medium">+{reg.cashSales.toLocaleString()}</td>
                <td className="px-5 py-4 text-right text-rose-600 dark:text-rose-400 font-mono font-medium">-{reg.expenses.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-bold text-slate-800 dark:text-[#e2f5e8] font-mono">{reg.expectedCash.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-bold text-blue-600 dark:text-blue-400 font-mono">
                  {reg.countedCash !== undefined ? reg.countedCash.toLocaleString() : '—'}
                </td>
                <td className="px-5 py-4 text-right">
                  {reg.variance !== undefined ? (
                    <span className={`font-bold font-mono ${reg.variance < 0 ? 'text-rose-600 dark:text-rose-400' : reg.variance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {reg.variance.toLocaleString()}
                    </span>
                  ) : <span className="text-slate-400 dark:text-slate-500">—</span>}
                </td>
                <td className="px-5 py-4 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${diffColors[reg.differenceStatus || 'Balanced']}`}>
                    {reg.differenceStatus}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => setViewRecord(reg)}
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-[#2d4a35] rounded-lg transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-[#e2f5e8]"
                    title="View Z-Report"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {registerHistory.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-slate-500 dark:text-slate-400 font-medium">
                  No historical registers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {viewRecord && (
        <ZReportDetailModal 
          record={viewRecord} 
          onClose={() => setViewRecord(null)} 
        />
      )}
    </div>
  );
};
