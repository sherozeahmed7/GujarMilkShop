import React, { useState } from 'react';
import { DateFilterType } from '../../types';
import { RevenueDataPoint } from '../../hooks/useDashboardData';

interface WeeklyRevenueProps {
  dateFilter: DateFilterType;
  data: RevenueDataPoint[];
  isLoading?: boolean;
  titleSuffix?: string;
  subtitle?: string;
}

export const WeeklyRevenue: React.FC<WeeklyRevenueProps> = ({
  dateFilter,
  data,
  isLoading,
  titleSuffix,
  subtitle,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const title  = titleSuffix ?? dateFilter.label;
  const sub    = subtitle ?? 'Daily revenue';

  // ── Chart geometry ────────────────────────────────────────────────────────
  const chartH = 160;
  const chartW = 700;
  const maxVal = Math.max(...(data ?? []).map((d) => d.value), 1);
  const totalRevenue = (data ?? []).reduce((s, d) => s + d.value, 0);
  const bestPoint = (data ?? []).reduce(
    (b, d) => (d.value > b.value ? d : b),
    (data ?? [])[0] ?? { label: '—', value: 0 },
  );

  const pts = (data ?? []).map((d, i) => ({
    x: data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2,
    y: chartH - (d.value / maxVal) * chartH,
    ...d,
  }));

  const buildPath = (p: typeof pts) => {
    if (p.length === 0) return '';
    if (p.length === 1) return `M ${p[0].x},${p[0].y}`;
    let d = `M ${p[0].x},${p[0].y}`;
    for (let i = 1; i < p.length; i++) {
      const cx = (p[i - 1].x + p[i].x) / 2;
      d += ` C ${cx},${p[i - 1].y} ${cx},${p[i].y} ${p[i].x},${p[i].y}`;
    }
    return d;
  };

  const pathD = buildPath(pts);
  const areaD = pts.length > 0
    ? `${pathD} L ${pts[pts.length - 1].x},${chartH} L ${pts[0].x},${chartH} Z`
    : '';

  const maxLabels = 10;
  const labelStep = Math.max(1, Math.ceil((data ?? []).length / maxLabels));
  const showLabel = (i: number) => i % labelStep === 0 || i === (data ?? []).length - 1;
  const dotR = (data ?? []).length > 20 ? 0 : 3.5;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-full relative">
      {/* Header */}
      <div className="flex justify-between items-start mb-5 gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            Revenue &mdash; <span className="text-blue-600">{title}</span>
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">{sub}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-slate-800">
            Rs.&nbsp;{totalRevenue.toLocaleString()}
          </div>
          {bestPoint && (
            <p className="text-xs text-slate-400 mt-0.5">
              Best:&nbsp;
              <span className="font-medium text-slate-600">
                {bestPoint.label} &mdash; Rs.&nbsp;{bestPoint.value.toLocaleString()}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 w-full relative min-h-[200px] mt-1">
        {isLoading ? (
          <div className="flex items-center justify-center h-full gap-2 text-slate-400 text-sm">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            Loading chart…
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm gap-2">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            No revenue data for this period.
          </div>
        ) : (
          <>
            <div className="absolute left-0 right-0 flex flex-col justify-between pointer-events-none" style={{ top: 0, bottom: 28 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="border-t border-dashed border-slate-100 w-full" />
              ))}
            </div>

            <svg viewBox={`0 -20 ${chartW} ${chartH + 40}`} className="w-full overflow-visible" style={{ height: 'calc(100% - 28px)' }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="revGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={areaD} fill="url(#revGrad)" />
              <path d={pathD} fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((p, i) => {
                const hitW = Math.max(40, chartW / data.length);
                return (
                  <g key={i} onMouseEnter={() => setHoveredIndex(i)} onMouseLeave={() => setHoveredIndex(null)} style={{ cursor: 'crosshair' }}>
                    <rect x={p.x - hitW / 2} y={-20} width={hitW} height={chartH + 40} fill="transparent" />
                    {hoveredIndex === i && <line x1={p.x} y1={-20} x2={p.x} y2={chartH} stroke="#3B82F6" strokeWidth="1" strokeDasharray="4 3" opacity="0.35" />}
                    <circle cx={p.x} cy={p.y} r={hoveredIndex === i ? 6 : dotR} fill="white" stroke="#3B82F6" strokeWidth="2" style={{ transition: 'r 0.15s ease' }} />
                  </g>
                );
              })}
            </svg>

            <div className="flex justify-between mt-1 overflow-hidden" style={{ height: 20 }}>
              {data.map((d, i) => (
                <span key={i} className="flex-1 text-center text-[10px] font-medium text-slate-400 truncate px-0.5" style={{ visibility: showLabel(i) ? 'visible' : 'hidden' }}>
                  {d.label}
                </span>
              ))}
            </div>

            {hoveredIndex !== null && pts[hoveredIndex] && (
              <div className="absolute z-20 pointer-events-none" style={{ left: `${(pts[hoveredIndex].x / chartW) * 100}%`, top: `${((pts[hoveredIndex].y + 20) / (chartH + 40)) * 85}%`, transform: 'translate(-50%, -110%)' }}>
                <div className="bg-slate-900 text-white rounded-lg shadow-2xl px-3 py-2 text-xs whitespace-nowrap">
                  <div className="font-bold text-sm leading-tight">Rs.&nbsp;{data[hoveredIndex].value.toLocaleString()}</div>
                  <div className="text-slate-300 text-center mt-0.5">{data[hoveredIndex].label}</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
