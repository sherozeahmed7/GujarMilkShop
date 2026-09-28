import { useTheme } from '../context/ThemeContext';

/** Theme-aware colors for Recharts axes, grids, and tooltips. */
export function useChartTheme() {
  const { isDark } = useTheme();

  return {
    isDark,
    grid: isDark ? '#2d4a35' : '#e2e8f0',
    axis: isDark ? '#8ba895' : '#94a3b8',
    tooltipStyle: isDark
      ? {
          backgroundColor: '#1a2e1f',
          border: '1px solid #2d4a35',
          borderRadius: '8px',
          color: '#e2f5e8',
        }
      : {
          backgroundColor: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
        },
    tooltipLabelStyle: { color: isDark ? '#e2f5e8' : '#334155' },
  };
}
