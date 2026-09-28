import React from 'react';
import { DailyMilkEntry } from '../../types/customerMilkReport';

interface MilkCalendarGridProps {
  month: number; // 0-indexed
  year: number;
  dailyEntries: DailyMilkEntry[];
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const fmtRs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

export const MilkCalendarGrid: React.FC<MilkCalendarGridProps> = ({ month, year, dailyEntries }) => {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun

  // Build flat array of cells: nulls for empty leading/trailing slots, numbers for days
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ...Array(totalCells - firstDayOfWeek - daysInMonth).fill(null),
  ];

  // Map dailyEntries by day number for O(1) lookup
  const entryByDay = new Map<number, DailyMilkEntry>();
  dailyEntries.forEach((e) => entryByDay.set(e.date, e));

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-xl border border-slate-200 dark:border-[#2d4a35] shadow-sm overflow-hidden mb-6">
      {/* Day headers */}
      <div className="grid grid-cols-7 bg-slate-800 dark:bg-[#142119] text-white dark:text-[#e2f5e8] text-xs font-semibold text-center">
        {DAYS.map((d) => (
          <div key={d} className="py-2.5 px-1">{d}</div>
        ))}
      </div>

      {/* Calendar rows */}
      {rows.map((row, rowIdx) => (
        <div key={rowIdx} className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-[#2d4a35] border-b border-slate-100 dark:border-[#2d4a35] last:border-b-0">
          {row.map((day, colIdx) => {
            if (day === null) {
              return <div key={colIdx} className="min-h-[80px] bg-slate-50/50 dark:bg-[#142119]/50" />;
            }
            const entry = entryByDay.get(day);
            const qty = entry?.quantityKg ?? 0;
            const amt = entry?.amount ?? 0;
            const hasEntry = qty > 0;

            return (
              <div
                key={colIdx}
                className={`min-h-[80px] p-2 flex flex-col gap-0.5 ${
                  hasEntry
                    ? 'bg-white dark:bg-[#1a2e1f] hover:bg-blue-50/30 dark:hover:bg-[#22c55e]/10 transition-colors'
                    : 'bg-slate-50/60 dark:bg-[#142119]/60'
                }`}
              >
                {/* Date number */}
                <span className={`text-xs font-bold ${
                  hasEntry ? 'text-slate-700 dark:text-[#a7c4ae]' : 'text-slate-400 dark:text-[#64916e]'
                }`}>
                  {day}
                </span>

                {/* Milk quantity */}
                <span className={`text-[11px] font-medium leading-tight ${
                  hasEntry ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-[#64916e]'
                }`}>
                  {hasEntry ? `${qty} kg` : '—'}
                </span>

                {/* Amount */}
                {hasEntry && (
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium leading-tight">
                    {fmtRs(amt)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
