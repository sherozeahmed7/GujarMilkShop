import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { rateService, RateHistoryEntry } from '../../services/rate.service';

function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatRoleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const DailyRates: React.FC = () => {
  const [milkRate, setMilkRate] = useState('');
  const [yogurtRate, setYogurtRate] = useState('');
  const [lassiRate, setLassiRate] = useState('');
  const [butterRate, setButterRate] = useState('');
  const [gheeRate, setGheeRate] = useState('');
  const [saved, setSaved] = useState({
    milk: '',
    yogurt: '',
    lassi: '',
    butter: '',
    ghee: '',
  });
  const [history, setHistory] = useState<RateHistoryEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const hasChanges =
    milkRate !== saved.milk ||
    yogurtRate !== saved.yogurt ||
    lassiRate !== saved.lassi ||
    butterRate !== saved.butter ||
    gheeRate !== saved.ghee;

  const loadRates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await rateService.getRates();
      const milk = String(data.currentMilkRate || '');
      const yogurt = String(data.currentYogurtRate || '');
      const lassi = String(data.currentLassiRate || '');
      const butter = String(data.currentButterRate || '');
      const ghee = String(data.currentGheeRate || '');
      setMilkRate(milk);
      setYogurtRate(yogurt);
      setLassiRate(lassi);
      setButterRate(butter);
      setGheeRate(ghee);
      setSaved({ milk, yogurt, lassi, butter, ghee });
      setHistory(data.history || []);
      setLastUpdated(data.lastUpdated);
      setLastUpdatedBy(data.history?.[0]?.updatedByRole ?? null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  const handleUpdate = async () => {
    setSuccessMsg(null);
    setError(null);

    const milk = parseFloat(milkRate);
    const yogurt = parseFloat(yogurtRate);
    const lassi = lassiRate.trim() === '' ? 0 : parseFloat(lassiRate);
    const butter = butterRate.trim() === '' ? 0 : parseFloat(butterRate);
    const ghee = gheeRate.trim() === '' ? 0 : parseFloat(gheeRate);

    if (Number.isNaN(milk) || milk <= 0 || Number.isNaN(yogurt) || yogurt <= 0) {
      setError('Milk and yogurt rates must be numbers greater than 0.');
      return;
    }
    if (
      Number.isNaN(lassi) ||
      lassi < 0 ||
      Number.isNaN(butter) ||
      butter < 0 ||
      Number.isNaN(ghee) ||
      ghee < 0
    ) {
      setError('Lassi, butter, and ghee rates must be 0 or greater.');
      return;
    }

    setSaving(true);
    try {
      await rateService.updateRates({
        milkRate: milk,
        yogurtRate: yogurt,
        lassiRate: lassi,
        butterRate: butter,
        gheeRate: ghee,
        date: todayDateString(),
      });
      setSuccessMsg('Rates updated successfully.');
      await loadRates();
    } catch (err: any) {
      setError(err?.message || 'Failed to update rates');
    } finally {
      setSaving(false);
    }
  };

  const rateInputClass =
    'w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 text-2xl md:text-3xl font-black text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:opacity-70 tabular-nums';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">Daily Rates Configuration</h1>
          <p className="text-slate-500 dark:text-[#8ba895] text-sm mt-1">
            Set milk, yogurt, lassi, butter &amp; ghee rates per kg. POS uses these automatically.
          </p>
        </div>
        <button
          onClick={loadRates}
          disabled={loading}
          className="flex items-center gap-2 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#1e3124] text-slate-700 dark:text-[#e2f5e8] px-4 py-2 rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex-shrink-0 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-sm font-medium">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex-shrink-0 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 px-4 py-3 text-sm font-medium">
          {successMsg}
        </div>
      )}

      <div className="flex-shrink-0 rounded-2xl bg-slate-900 text-white p-6 md:p-8 shadow-lg border border-slate-800">
        {loading && history.length === 0 ? (
          <div className="py-10 text-center text-slate-400 dark:text-[#64916e] text-sm">Loading rates…</div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
              <div>
                <div className="text-base font-bold text-white mb-1">Milk</div>
                <div className="text-xs text-slate-400 dark:text-[#64916e] mb-2">Rs/kg</div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={milkRate}
                  onChange={(e) => {
                    setMilkRate(e.target.value);
                    setSuccessMsg(null);
                  }}
                  disabled={saving}
                  className={rateInputClass}
                  placeholder="0"
                />
              </div>

              <div>
                <div className="text-base font-bold text-white mb-1">Yogurt</div>
                <div className="text-xs text-slate-400 dark:text-[#64916e] mb-2">Rs/kg</div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={yogurtRate}
                  onChange={(e) => {
                    setYogurtRate(e.target.value);
                    setSuccessMsg(null);
                  }}
                  disabled={saving}
                  className={rateInputClass}
                  placeholder="0"
                />
              </div>

              <div>
                <div className="text-base font-bold text-white mb-1">Lassi</div>
                <div className="text-xs text-slate-400 dark:text-[#64916e] mb-2">Rs/kg (F2)</div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={lassiRate}
                  onChange={(e) => {
                    setLassiRate(e.target.value);
                    setSuccessMsg(null);
                  }}
                  disabled={saving}
                  className={rateInputClass}
                  placeholder="0"
                />
              </div>

              <div>
                <div className="text-base font-bold text-white mb-1">Butter</div>
                <div className="text-xs text-slate-400 dark:text-[#64916e] mb-2">Rs/kg (F2)</div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={butterRate}
                  onChange={(e) => {
                    setButterRate(e.target.value);
                    setSuccessMsg(null);
                  }}
                  disabled={saving}
                  className={rateInputClass}
                  placeholder="0"
                />
              </div>

              <div>
                <div className="text-base font-bold text-white mb-1">Ghee</div>
                <div className="text-xs text-slate-400 dark:text-[#64916e] mb-2">Rs/kg (F2)</div>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={gheeRate}
                  onChange={(e) => {
                    setGheeRate(e.target.value);
                    setSuccessMsg(null);
                  }}
                  disabled={saving}
                  className={rateInputClass}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <p className="text-sm text-slate-400 dark:text-[#64916e]">
                Last updated:{' '}
                <span className="text-slate-200 dark:text-[#2d4a35] font-medium">
                  {formatDisplayDate(lastUpdated)}
                  {lastUpdatedBy ? ` by ${formatRoleLabel(lastUpdatedBy)}` : ''}
                </span>
              </p>

              <button
                onClick={handleUpdate}
                disabled={!hasChanges || saving || loading}
                className="bg-amber-400 hover:bg-amber-300 text-slate-900 dark:text-[#e2f5e8] font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-amber-400 shadow-sm"
              >
                {saving ? 'Updating…' : 'Update Rates'}
              </button>
            </div>
          </>
        )}
      </div>

      <div className="flex flex-col bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-200 dark:border-[#2d4a35] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Rate History</h2>
        </div>

        <div className="w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-[#142119] border-b border-slate-100 dark:border-[#2d4a35]">
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba895]">
                <th className="px-5 py-3">Date &amp; Time</th>
                <th className="px-5 py-3">Milk</th>
                <th className="px-5 py-3">Yogurt</th>
                <th className="px-5 py-3">Lassi</th>
                <th className="px-5 py-3">Butter</th>
                <th className="px-5 py-3">Ghee</th>
                <th className="px-5 py-3">Updated By</th>
              </tr>
            </thead>
            <tbody>
              {loading && history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-[#64916e]">
                    Loading history…
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400 dark:text-[#64916e]">
                    No rate history yet. Update rates to create the first entry.
                  </td>
                </tr>
              ) : (
                history.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 dark:border-[#2d4a35] hover:bg-slate-50/80 dark:hover:bg-[#1e3124]">
                    <td className="px-5 py-3.5 text-slate-700 dark:text-[#e2f5e8] font-medium">
                      {formatDisplayDate(row.date)}
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 dark:text-[#e2f5e8] font-semibold tabular-nums">
                      {row.milkRate}
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 dark:text-[#e2f5e8] font-semibold tabular-nums">
                      {row.yogurtRate}
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 dark:text-[#e2f5e8] font-semibold tabular-nums">
                      {row.lassiRate ?? 0}
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 dark:text-[#e2f5e8] font-semibold tabular-nums">
                      {row.butterRate ?? 0}
                    </td>
                    <td className="px-5 py-3.5 text-slate-800 dark:text-[#e2f5e8] font-semibold tabular-nums">
                      {row.gheeRate ?? 0}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 dark:text-[#a7c4ae]">
                      {formatRoleLabel(row.updatedByRole)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
