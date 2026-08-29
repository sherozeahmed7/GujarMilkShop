import React, { useState, useRef, useEffect } from 'react';
import { Calendar, Search, RefreshCw } from 'lucide-react';
import { DateFilterType } from '../../types';

interface ReportFiltersProps {
  currentFilter: DateFilterType;
  onFilterChange: (filter: DateFilterType) => void;
  onRefresh: () => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  isLoading?: boolean;
  /** Show All Time preset (null dates) — for Khata Ledger etc. */
  allowAllTime?: boolean;
}

const BASE_PRESETS = [
  { label: 'Today' },
  { label: 'Yesterday' },
  { label: 'This Week' },
  { label: 'This Month' },
  { label: 'Last Month' },
  { label: 'This Year' }
];

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  currentFilter,
  onFilterChange,
  onRefresh,
  searchTerm,
  onSearchChange,
  isLoading,
  allowAllTime = false,
}) => {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const presets = allowAllTime
    ? [{ label: 'All Time' }, ...BASE_PRESETS]
    : BASE_PRESETS;

  const popupRef = useRef<HTMLDivElement>(null);

  // Close custom picker on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setShowCustomPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      const start = new Date(customStart);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(customEnd);
      end.setHours(23, 59, 59, 999);
      
      const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      
      onFilterChange({ 
        label: `${fmt(start)} - ${fmt(end)}`, 
        startDate: start, 
        endDate: end 
      });
      setShowCustomPicker(false);
    }
  };

  const handlePresetClick = (label: string) => {
    if (label === 'All Time') {
      onFilterChange({ label: 'All Time', startDate: null, endDate: null });
      setShowCustomPicker(false);
      return;
    }

    const start = new Date();
    start.setHours(0,0,0,0);
    const end = new Date();
    end.setHours(23,59,59,999);

    if (label === 'Yesterday') {
      start.setDate(start.getDate() - 1);
      end.setDate(end.getDate() - 1);
    } else if (label === 'This Week') {
      const dow = start.getDay();
      start.setDate(start.getDate() - dow);
    } else if (label === 'This Month') {
      start.setDate(1);
    } else if (label === 'Last Month') {
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      end.setDate(0); // Last day of previous month
    } else if (label === 'This Year') {
      start.setMonth(0, 1);
    }
    
    onFilterChange({ label, startDate: start, endDate: end });
    setShowCustomPicker(false);
  };

  const isCustom = !presets.some((p) => p.label === currentFilter.label);

  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
      
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 text-slate-800 font-semibold mr-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          <span className="hidden sm:inline">Date Range</span>
        </div>

        {presets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePresetClick(preset.label)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              currentFilter.label === preset.label 
                ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {preset.label}
          </button>
        ))}

        <div className="relative" ref={popupRef}>
          <button
            onClick={() => setShowCustomPicker(!showCustomPicker)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
              isCustom 
                ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {isCustom ? currentFilter.label : 'Custom'}
          </button>

          {showCustomPicker && (
            <div className="absolute top-full mt-2 left-0 z-50 bg-white rounded-xl shadow-xl border border-slate-200 p-4 flex flex-col gap-3 min-w-[280px]">
              <h4 className="text-sm font-bold text-slate-800">Custom Range</h4>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">From Date</label>
                <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-500">To Date</label>
                <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button onClick={() => setShowCustomPicker(false)} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">Reset</button>
                <button onClick={handleApplyCustom} disabled={!customStart || !customEnd}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">Apply</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 w-full xl:w-auto">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 xl:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search in report..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
        
        <button 
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
          title="Refresh Data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

    </div>
  );
};
