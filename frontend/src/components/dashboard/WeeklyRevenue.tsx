import React, { useState, useMemo } from 'react';
import { DateFilterType } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RevenueDataPoint {
  /** Human-readable label shown on the X-axis */
  label: string;
  /** Revenue amount in PKR */
  value: number;
}

type ChartInterval = 'hourly' | 'daily';

interface ChartConfig {
  interval: ChartInterval;
  data: RevenueDataPoint[];
  /** Dynamic title suffix e.g. "Today", "This Week", "01 Aug – 16 Aug" */
  titleSuffix: string;
  subtitle: string;
}

// ---------------------------------------------------------------------------
// Mock-data generators
// NOTE: Replace each function body with real SQLite/API calls later.
// The function signatures and return types (RevenueDataPoint[]) must stay.
// ---------------------------------------------------------------------------

function rnd(base: number, spread: number): number {
  return Math.round(base + (Math.random() - 0.5) * spread);
}

function mockHourlyToday(): RevenueDataPoint[] {
  const now = new Date();
  return Array.from({ length: 7 }, (_, idx) => {
    const h = new Date(now);
    h.setHours(now.getHours() - (6 - idx), 0, 0, 0);
    const hr = h.getHours();
    const label = `${hr % 12 === 0 ? 12 : hr % 12}${hr >= 12 ? 'PM' : 'AM'}`;
    return { label, value: rnd(18000, 14000) };
  });
}

function mockHourlyYesterday(): RevenueDataPoint[] {
  return Array.from({ length: 24 }, (_, h) => ({
    label: `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'PM' : 'AM'}`,
    value: rnd(12000, 18000),
  }));
}

function mockDailyThisWeek(): RevenueDataPoint[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  const dow = today.getDay();
  const count = dow === 0 ? 1 : dow; // at least today
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (count - 1 - i));
    return { label: days[d.getDay()], value: rnd(130000, 80000) };
  });
}

function mockDailyThisMonth(): RevenueDataPoint[] {
  const today = new Date();
  return Array.from({ length: today.getDate() }, (_, i) => ({
    label: `${i + 1}`,
    value: rnd(120000, 100000),
  }));
}

function mockCustomRange(
  start: Date,
  end: Date,
): { data: RevenueDataPoint[]; interval: ChartInterval } {
  const msDay = 86400000;
  const diffDays = Math.round((end.getTime() - start.getTime()) / msDay) + 1;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (diffDays <= 1) {
    return {
      interval: 'hourly',
      data: Array.from({ length: 24 }, (_, h) => ({
        label: `${h % 12 === 0 ? 12 : h % 12}${h >= 12 ? 'PM' : 'AM'}`,
        value: rnd(12000, 18000),
      })),
    };
  }

  const cap = Math.min(diffDays, 31);
  return {
    interval: 'daily',
    data: Array.from({ length: cap }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const label =
        diffDays <= 7 ? days[d.getDay()] : `${d.getDate()}/${d.getMonth() + 1}`;
      return { label, value: rnd(120000, 100000) };
    }),
  };
}

// ---------------------------------------------------------------------------
// Config builder
// ---------------------------------------------------------------------------

function buildChartConfig(dateFilter: DateFilterType): ChartConfig {
  const { label } = dateFilter;

  if (label === 'Today') {
    return {
      interval: 'hourly',
      data: mockHourlyToday(),
      titleSuffix: 'Today',
      subtitle: 'Hourly revenue — last 7 hours',
    };
  }
  if (label === 'Yesterday') {
    return {
      interval: 'hourly',
      data: mockHourlyYesterday(),
      titleSuffix: 'Yesterday',
      subtitle: 'Hourly revenue — 24-hour cycle',
    };
  }
  if (label === 'This Week') {
    return {
      interval: 'daily',
      data: mockDailyThisWeek(),
      titleSuffix: 'This Week',
      subtitle: 'Daily revenue — current week',
    };
  }
  if (label === 'This Month') {
    return {
      interval: 'daily',
      data: mockDailyThisMonth(),
      titleSuffix: 'This Month',
      subtitle: 'Daily revenue — current month',
    };
  }

  // Custom range
  const start = dateFilter.startDate ?? new Date();
  const end = dateFilter.endDate ?? new Date();
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  const { data, interval } = mockCustomRange(start, end);
  return {
    interval,
    data,
    titleSuffix: `${fmt(start)} – ${fmt(end)}`,
    subtitle: interval === 'hourly' ? 'Hourly revenue' : 'Daily revenue',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface WeeklyRevenueProps {
  dateFilter: DateFilterType;
}

export const WeeklyRevenue: React.FC<WeeklyRevenueProps> = ({ dateFilter }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const config = useMemo<ChartConfig>(
    () => buildChartConfig(dateFilter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateFilter.label, dateFilter.startDate?.toISOString(), dateFilter.endDate?.toISOString()],
  );

  const { data, titleSuffix, subtitle } = config;

  // ── Chart geometry ────────────────────────────────────────────────────────
  const chartH = 160;
  const chartW = 700;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const totalRevenue = data.reduce((s, d) => s + d.value, 0);
  const bestPoint = data.reduce(
    (b, d) => (d.value > b.value ? d : b),
    data[0] ?? { label: '—', value: 0 },
  );

  const pts = data.map((d, i) => ({
    x: data.length > 1 ? (i / (data.length - 1)) * chartW : chartW / 2,
    y: chartH - (d.value / maxVal) * chartH,
    ...d,
  }));

  // Smooth cubic-bezier path
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
  const areaD =
    pts.length > 0
      ? `${pathD} L ${pts[pts.length - 1].x},${chartH} L ${pts[0].x},${chartH} Z`
      : '';

  // Thin X-axis labels when there are many points
  const maxLabels = 10;
  const labelStep = Math.max(1, Math.ceil(data.length / maxLabels));
  const showLabel = (i: number) => i % labelStep === 0 || i === data.length - 1;

  // Dot radius: hide dots when too many points
  const dotR = data.length > 20 ? 0 : 3.5;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col h-full relative">
      {/* Header */}
      <div className="flex justify-between items-start mb-5 gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">
            Revenue &mdash;{' '}
            <span className="text-blue-600">{titleSuffix}</span>
          </h3>
          <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-lg font-bold text-slate-800">
            Rs.&nbsp;{totalRevenue.toLocaleString()}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Best:&nbsp;
            <span className="font-medium text-slate-600">
              {bestPoint.label} &mdash; Rs.&nbsp;{bestPoint.value.toLocaleString()}
            </span>
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 w-full relative min-h-[200px] mt-1">
        {data.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            No data available for this period.
          </div>
        ) : (
          <>
            {/* Subtle dashed grid lines */}
            <div
              className="absolute left-0 right-0 flex flex-col justify-between pointer-events-none"
              style={{ top: 0, bottom: 28 }}
            >
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="border-t border-dashed border-slate-100 w-full" />
              ))}
            </div>

            {/* SVG */}
            <svg
              viewBox={`0 -20 ${chartW} ${chartH + 40}`}
              className="w-full overflow-visible"
              style={{ height: 'calc(100% - 28px)' }}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="revGrad" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#3B82F6" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Area */}
              <path d={areaD} fill="url(#revGrad)" />

              {/* Line */}
              <path
                d={pathD}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interaction zones */}
              {pts.map((p, i) => {
                const hitW = Math.max(40, chartW / data.length);
                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    style={{ cursor: 'crosshair' }}
                  >
                    <rect
                      x={p.x - hitW / 2}
                      y={-20}
                      width={hitW}
                      height={chartH + 40}
                      fill="transparent"
                    />

                    {/* Crosshair */}
                    {hoveredIndex === i && (
                      <line
                        x1={p.x}
                        y1={-20}
                        x2={p.x}
                        y2={chartH}
                        stroke="#3B82F6"
                        strokeWidth="1"
                        strokeDasharray="4 3"
                        opacity="0.35"
                      />
                    )}

                    {/* Dot */}
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={hoveredIndex === i ? 6 : dotR}
                      fill="white"
                      stroke="#3B82F6"
                      strokeWidth="2"
                      style={{ transition: 'r 0.15s ease' }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* X-axis labels */}
            <div className="flex justify-between mt-1 overflow-hidden" style={{ height: 20 }}>
              {data.map((d, i) => (
                <span
                  key={i}
                  className="flex-1 text-center text-[10px] font-medium text-slate-400 truncate px-0.5"
                  style={{ visibility: showLabel(i) ? 'visible' : 'hidden' }}
                >
                  {d.label}
                </span>
              ))}
            </div>

            {/* Tooltip */}
            {hoveredIndex !== null && pts[hoveredIndex] && (
              <div
                className="absolute z-20 pointer-events-none"
                style={{
                  left: `${(pts[hoveredIndex].x / chartW) * 100}%`,
                  top: `${((pts[hoveredIndex].y + 20) / (chartH + 40)) * 85}%`,
                  transform: 'translate(-50%, -110%)',
                }}
              >
                <div className="bg-slate-900 text-white rounded-lg shadow-2xl px-3 py-2 text-xs whitespace-nowrap">
                  <div className="font-bold text-sm leading-tight">
                    Rs.&nbsp;{data[hoveredIndex].value.toLocaleString()}
                  </div>
                  <div className="text-slate-300 text-center mt-0.5">
                    {data[hoveredIndex].label}
                  </div>
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
