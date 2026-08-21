import React from 'react';
import { SCREEN_PERMISSIONS, ALL_SCREENS } from '../../config/screenPermissions';

interface PermissionSelectorProps {
  selectedScreens: string[];
  onChange: (screens: string[]) => void;
  disabled?: boolean;
}

export const PermissionSelector: React.FC<PermissionSelectorProps> = ({
  selectedScreens,
  onChange,
  disabled = false
}) => {
  const handleToggle = (screen: string) => {
    if (disabled) return;
    if (selectedScreens.includes(screen)) {
      onChange(selectedScreens.filter(s => s !== screen));
    } else {
      onChange([...selectedScreens, screen]);
    }
  };

  const handleSelectAll = () => {
    if (!disabled) onChange([...ALL_SCREENS]);
  };

  const handleClearAll = () => {
    if (!disabled) onChange([]);
  };

  const renderGroup = (title: string, screens: string[]) => (
    <div className="mb-6 last:mb-0">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">{title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {screens.map(screen => (
          <label 
            key={screen} 
            className={`flex items-center gap-2 p-2 rounded-lg border ${
              selectedScreens.includes(screen) 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            } ${disabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer transition-colors'}`}
          >
            <input
              type="checkbox"
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 disabled:opacity-50"
              checked={selectedScreens.includes(screen)}
              onChange={() => handleToggle(screen)}
              disabled={disabled}
            />
            <span className="text-sm font-medium">{screen}</span>
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className="text-sm font-medium text-slate-700">Assigned Screens</span>
          <p className="text-xs text-slate-500">{selectedScreens.length} of {ALL_SCREENS.length} screens selected</p>
        </div>
        {!disabled && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 px-2 py-1 rounded hover:bg-emerald-50"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-200"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
        {renderGroup('MAIN MODULES', SCREEN_PERMISSIONS.MAIN_MODULES)}
        {renderGroup('SETTINGS', SCREEN_PERMISSIONS.SETTINGS)}
        {renderGroup('REPORTS', SCREEN_PERMISSIONS.REPORTS)}
      </div>
    </div>
  );
};
