import React, { useState } from 'react';
import { Settings } from 'lucide-react';
import { useBackupStore } from '../../../store/backupStore';
import { updateBackupSettings } from '../../../services/backupService';
import { toast } from 'react-hot-toast';

export const AutoBackupSettings: React.FC = () => {
  const { autoBackupSettings, setAutoBackupSettings } = useBackupStore();
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = async (field: string, value: string | boolean) => {
    const newSettings = { ...autoBackupSettings, [field]: value };
    setAutoBackupSettings(newSettings);
    
    try {
      setIsSaving(true);
      await updateBackupSettings(newSettings);
      toast.success('Auto backup settings updated.');
    } catch (e) {
      toast.error('Failed to update settings.');
      // Revert if needed
      setAutoBackupSettings(autoBackupSettings);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="p-6">
        <div className="flex items-center gap-2 mb-6 text-slate-800">
          <Settings className="w-5 h-5 text-emerald-600" />
          <h2 className="text-lg font-bold">Auto Backup Settings</h2>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-slate-700">Enable Automatic Backup</div>
              <div className="text-xs text-slate-500">Run backups automatically based on schedule</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={autoBackupSettings.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
                disabled={isSaving}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Backup Schedule</label>
              <select 
                value={autoBackupSettings.schedule}
                onChange={(e) => handleChange('schedule', e.target.value)}
                disabled={!autoBackupSettings.enabled || isSaving}
                className="w-full rounded-lg border-slate-200 text-sm focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Backup Time</label>
              <input 
                type="time" 
                value={autoBackupSettings.time}
                onChange={(e) => handleChange('time', e.target.value)}
                disabled={!autoBackupSettings.enabled || isSaving}
                className="w-full rounded-lg border-slate-200 text-sm focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Retention</label>
              <select 
                value={autoBackupSettings.retention}
                onChange={(e) => handleChange('retention', e.target.value)}
                disabled={!autoBackupSettings.enabled || isSaving}
                className="w-full rounded-lg border-slate-200 text-sm focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="7">Keep last 7 backups</option>
                <option value="30">Keep last 30 backups</option>
                <option value="90">Keep last 90 backups</option>
                <option value="all">Keep all backups</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
