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
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
        <TrendingUp className="w-4 h-4 text-slate-500" />
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Register History</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Date</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Opening</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-emerald-600 uppercase tracking-wider border-b border-slate-100">Cash In (Sales)</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-rose-600 uppercase tracking-wider border-b border-slate-100">Cash Out (Exp)</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Expected</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Actual</th>
              <th className="text-right px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Variance</th>
              <th className="text-center px-5 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Status</th>
              <th className="px-5 py-4 border-b border-slate-100"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {registerHistory.map((reg) => (
              <tr key={reg.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-4 font-bold text-slate-800">{reg.date}</td>
                <td className="px-5 py-4 text-right text-slate-600 font-mono">{reg.openingBalance.toLocaleString()}</td>
                <td className="px-5 py-4 text-right text-emerald-600 font-mono font-medium">+{reg.cashSales.toLocaleString()}</td>
                <td className="px-5 py-4 text-right text-rose-600 font-mono font-medium">-{reg.expenses.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-bold text-slate-800 font-mono">{reg.expectedCash.toLocaleString()}</td>
                <td className="px-5 py-4 text-right font-bold text-blue-600 font-mono">
                  {reg.countedCash !== undefined ? reg.countedCash.toLocaleString() : '—'}
                </td>
                <td className="px-5 py-4 text-right">
                  {reg.variance !== undefined ? (
                    <span className={`font-bold font-mono ${reg.variance < 0 ? 'text-rose-600' : reg.variance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {reg.variance.toLocaleString()}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-5 py-4 text-center">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${diffColors[reg.differenceStatus || 'Balanced']}`}>
                    {reg.differenceStatus}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    onClick={() => setViewRecord(reg)}
                    className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-slate-400 hover:text-slate-600"
                    title="View Z-Report"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
            {registerHistory.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-slate-500 font-medium">
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
