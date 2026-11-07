import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, Cloud, CloudOff, AlertCircle, HardDrive, Wifi, WifiOff, Clock, DownloadCloud, Play, Link2Off, Link2, Wrench, CheckCircle } from 'lucide-react';
import { cloudSyncService, CloudStatusData, SyncItem } from '../../services/cloudSync.service';
import { RestoreCloudDataModal } from '../../components/settings/RestoreCloudDataModal';
import { Pagination } from '../../components/common/Pagination';

const POLL_INTERVAL_MS = 10_000;

function formatTs(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch {
    return iso;
  }
}

const PAGE_SIZE = 50;

export const CloudSync: React.FC = () => {
  const [statusData, setStatusData] = useState<CloudStatusData | null>(null);
  const [queue, setQueue] = useState<SyncItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [repairing, setRepairing] = useState(false);
  const [repairReport, setRepairReport] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [status, pendingItems] = await Promise.all([
        cloudSyncService.getStatus(),
        cloudSyncService.getPendingItems(),
      ]);
      setStatusData(status);
      setQueue(pendingItems);
      setCurrentPage(1); // reset to first page on fresh load
    } catch (err: any) {
      setError(err?.message || 'Failed to load cloud sync status');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 10-second polling — stops on unmount
  useEffect(() => {
    pollerRef.current = setInterval(() => {
      loadData(true); // silent = true so we don't flash a spinner
    }, POLL_INTERVAL_MS);
    return () => {
      if (pollerRef.current) clearInterval(pollerRef.current);
    };
  }, [loadData]);

  const handleCheckConnection = async () => {
    setActionInProgress(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await cloudSyncService.checkRegistration();
      setSuccessMsg('Cloud connection verified. Neon PostgreSQL is reachable.');
      await loadData();
    } catch (err: any) {
      setError('Cloud connection check failed. Neon may be unreachable.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Disconnect from cloud sync? Local POS data will not be deleted, and existing pending events remain safe. You can reconnect at any time.')) {
      return;
    }
    setActionInProgress(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await cloudSyncService.disconnect();
      setSuccessMsg('Cloud sync paused. POS continues working fully offline.');
      await loadData();
    } catch (err: any) {
      setError('Failed to disconnect. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReconnect = async () => {
    setActionInProgress(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await cloudSyncService.reconnect();
      setSuccessMsg('Cloud sync re-enabled. Worker will resume shortly.');
      await loadData();
    } catch (err: any) {
      setError('Failed to reconnect. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const result = await cloudSyncService.syncNow();
      if (result.success) {
        setSuccessMsg(result.message);
      } else {
        setError(result.message);
      }
      await loadData();
    } catch (err: any) {
      setError('Sync trigger failed. Backend may be unreachable.');
    } finally {
      setSyncing(false);
    }
  };

  const handleRetryItem = async (id: string) => {
    setActionInProgress(true);
    try {
      await cloudSyncService.retryItem(id);
      setSuccessMsg('Event re-queued for sync.');
      await loadData();
    } catch {
      // silent
    } finally {
      setActionInProgress(false);
    }
  };

  const handleAutoRepair = async () => {
    setRepairing(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await cloudSyncService.autoRepair();
      if (res.success) {
        setRepairReport(res.report);
        const details = [];
        if (res.report?.staleSyncingReset) details.push(`${res.report.staleSyncingReset} stale locks cleared`);
        if (res.report?.failedEventsHealed) details.push(`${res.report.failedEventsHealed} failed events re-queued`);
        if (res.report?.orphanedMappingsRepaired) details.push(`${res.report.orphanedMappingsRepaired} mappings healed`);
        const summary = details.length > 0 ? ` (${details.join(', ')})` : '';
        setSuccessMsg(`Auto-repair complete! Sync loops re-engaged${summary}.`);
      } else {
        setError(res.message || 'Auto-repair encountered an issue.');
      }
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Auto-repair failed to execute.');
    } finally {
      setRepairing(false);
    }
  };

  const handleRetryAll = async () => {
    setActionInProgress(true);
    setError(null);
    setSuccessMsg(null);
    try {
      await cloudSyncService.retryAll();
      setSuccessMsg('All failed events have been re-queued for sync.');
      await loadData();
    } catch (err: any) {
      setError('Retry failed. Please try again.');
    } finally {
      setActionInProgress(false);
    }
  };

  const isDisconnected = statusData?.status === 'Disconnected';
  const isOffline = statusData?.status === 'Offline';

  // Pagination
  const pageItems = queue.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">Cloud &amp; Sync</h1>
          <p className="text-slate-500 dark:text-[#8ba895] text-sm mt-1">
            Connect your POS to the cloud for backup, remote reports, and multi-device synchronization.
          </p>
          <div className="inline-flex items-center gap-1.5 mt-2 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md border border-blue-100 text-xs font-medium">
            <AlertCircle className="w-3.5 h-3.5" />
            This is optional — your POS works fully offline without cloud sync.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Auto-Repair Sync */}
          <button
            onClick={handleAutoRepair}
            disabled={loading || syncing || repairing || actionInProgress}
            title="Diagnose sync bottlenecks, reset stuck locks, heal failed events, and trigger sync"
            className="flex items-center gap-2 bg-white dark:bg-[#1a2e1f] hover:bg-slate-50 dark:hover:bg-[#1e3124] border border-amber-200 dark:border-[#3d2f12] text-amber-800 dark:text-[#fcd34d] px-4 py-2 rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            <Wrench className={`w-4 h-4 text-amber-600 ${repairing ? 'animate-bounce' : ''}`} />
            {repairing ? 'Repairing…' : 'Auto-Repair Sync'}
          </button>

          {/* Restore Cloud Data */}
          <button
            onClick={() => setIsRestoreModalOpen(true)}
            disabled={loading || syncing || repairing || actionInProgress || !statusData?.cloudConnected}
            title={!statusData?.cloudConnected ? 'Connect to cloud to restore data.' : 'Restore data from online cloud backup'}
            className="flex items-center gap-2 bg-white dark:bg-[#1a2e1f] hover:bg-slate-50 dark:hover:bg-[#1e3124] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#e2f5e8] px-4 py-2 rounded-xl font-medium shadow-sm transition-colors disabled:opacity-50"
          >
            <DownloadCloud className="w-4 h-4 text-blue-600" />
            Restore Cloud Data
          </button>

          <button
            onClick={handleSyncNow}
            disabled={loading || syncing || repairing || actionInProgress || isDisconnected}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Offline banner */}
      {isOffline && (
        <div className="flex-shrink-0 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 px-4 py-3 text-sm font-medium">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span><strong>Offline</strong> — Changes are being saved locally. The sync worker will resume automatically when the connection is restored.</span>
        </div>
      )}

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

      {/* Main Content Area */}
      <div className="flex flex-col gap-6">
        {loading && !statusData ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-[#64916e] text-sm">Loading sync status...</div>
        ) : (
          <>
            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 flex-shrink-0">

              {/* Sync Status Card */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-200 dark:border-[#2d4a35] p-6 flex items-center gap-4 shadow-sm">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  statusData?.status === 'Online'       ? 'bg-emerald-100 text-emerald-600' :
                  statusData?.status === 'Disconnected' ? 'bg-slate-100 dark:bg-[#111e14] text-slate-500 dark:text-[#8ba895]' :
                  statusData?.status === 'Syncing'      ? 'bg-blue-100 text-blue-600' :
                  statusData?.status === 'Offline'      ? 'bg-amber-100 text-amber-600' : 'bg-rose-100 text-rose-600'
                }`}>
                  {statusData?.status === 'Online'       ? <Cloud className="w-6 h-6" /> :
                   statusData?.status === 'Disconnected' ? <CloudOff className="w-6 h-6" /> :
                   statusData?.status === 'Syncing'      ? <RefreshCw className="w-6 h-6 animate-spin" /> :
                   statusData?.status === 'Offline'      ? <WifiOff className="w-6 h-6" /> :
                   <AlertCircle className="w-6 h-6" />}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-0.5">Sync Status</div>
                  <div className={`text-xl font-black ${
                    statusData?.status === 'Online'       ? 'text-emerald-600' :
                    statusData?.status === 'Disconnected' ? 'text-slate-700 dark:text-[#e2f5e8]' :
                    statusData?.status === 'Syncing'      ? 'text-blue-600' :
                    statusData?.status === 'Offline'      ? 'text-amber-600' : 'text-rose-600'
                  }`}>
                    {statusData?.status?.toUpperCase() ?? 'LOADING'}
                  </div>
                </div>
              </div>

              {/* Pending Items Card */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-200 dark:border-[#2d4a35] p-6 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-0.5">Pending Items</div>
                  <div className="text-xl font-black text-amber-600">{statusData?.pendingCount ?? 0}</div>
                </div>
              </div>

              {/* Failed Items Card */}
              <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-200 dark:border-[#2d4a35] p-6 flex items-center gap-4 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-0.5">Failed Items</div>
                  <div className="text-xl font-black text-rose-600">{statusData?.failedCount ?? 0}</div>
                </div>
              </div>

            </div>

            {/* Cloud Connection Details */}
            <div className="flex-shrink-0 bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-200 dark:border-[#2d4a35] shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35]">
                <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Cloud Connection</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">API URL</label>
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4 text-slate-400 dark:text-[#64916e]" />
                      <span className="text-sm font-medium text-slate-800 dark:text-[#e2f5e8] break-all">{statusData?.vpsUrl || '—'}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Device ID</label>
                    <div className="text-sm font-bold text-slate-800 dark:text-[#e2f5e8] bg-slate-100 dark:bg-[#111e14] px-2 py-1 rounded inline-block font-mono break-all">
                      {statusData?.deviceId || '—'}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Shop Name</label>
                    <div className="text-sm font-medium text-slate-800 dark:text-[#e2f5e8]">{statusData?.shopName || '—'}</div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Last Checked</label>
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-[#e2f5e8]">
                      <Clock className="w-4 h-4 text-slate-400 dark:text-[#64916e]" />
                      {formatTs(statusData?.lastChecked)}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider mb-1">Last Successful Sync</label>
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600">
                      <RefreshCw className="w-4 h-4" />
                      {formatTs(statusData?.lastSuccessfulSync)}
                    </div>
                  </div>

                </div>
              </div>

              <div className="bg-slate-50 dark:bg-[#142119] px-6 py-4 border-t border-slate-100 dark:border-[#2d4a35] flex items-center justify-between">
                <button
                  onClick={handleCheckConnection}
                  disabled={actionInProgress || syncing}
                  className="bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-100 dark:hover:bg-[#1e3124] text-slate-700 dark:text-[#e2f5e8] px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                >
                  Check Cloud Connection
                </button>

                {isDisconnected ? (
                  <button
                    onClick={handleReconnect}
                    disabled={actionInProgress || syncing}
                    className="flex items-center gap-2 bg-white dark:bg-[#1a2e1f] border border-emerald-200 hover:bg-emerald-50 text-emerald-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <Link2 className="w-4 h-4" />
                    Reconnect
                  </button>
                ) : (
                  <button
                    onClick={handleDisconnect}
                    disabled={actionInProgress || syncing}
                    className="flex items-center gap-2 bg-white dark:bg-[#1a2e1f] border border-rose-200 hover:bg-rose-50 text-rose-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
                  >
                    <Link2Off className="w-4 h-4" />
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* Sync Queue */}
            <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl border border-slate-200 dark:border-[#2d4a35] shadow-sm overflow-hidden mb-6">
              {/* Queue Header */}
              <div className="px-5 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Sync Queue</h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleRetryAll}
                    disabled={(statusData?.failedCount ?? 0) === 0 || actionInProgress || syncing}
                    className="text-sm bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#1e3124] text-slate-700 dark:text-[#e2f5e8] px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 shadow-sm"
                  >
                    Retry All Failed
                  </button>
                </div>
              </div>

              {/* Table — natural height, no inner scroll */}
              <table className="w-full text-sm table-fixed">
                <thead className="bg-slate-50 dark:bg-[#142119] border-b border-slate-100 dark:border-[#2d4a35]">
                  <tr className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-[#8ba895]">
                    <th className="px-5 py-3 w-2/5">Record</th>
                    <th className="px-5 py-3 w-28">Module</th>
                    <th className="px-5 py-3 w-20">Action</th>
                    <th className="px-5 py-3 w-36">Created At</th>
                    <th className="px-5 py-3 w-36">Status</th>
                    <th className="px-5 py-3 w-16 text-right">Retry</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-[#64916e]">
                        No pending synchronization items. Everything is synced!
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((item) => (
                      <tr key={item.id} className="border-b border-slate-100 dark:border-[#2d4a35] hover:bg-slate-50/80 dark:hover:bg-[#1e3124]">
                        <td className="px-5 py-3.5 text-slate-800 dark:text-[#e2f5e8] font-bold truncate" title={item.record}>{item.record}</td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-[#a7c4ae] font-medium truncate" title={item.module}>{item.module}</td>
                        <td className="px-5 py-3.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${
                            item.action === 'CREATE' ? 'bg-emerald-100 text-emerald-700' :
                            item.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {item.action}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 dark:text-[#8ba895] text-xs whitespace-nowrap">{formatTs(item.createdAt)}</td>
                        <td className="px-5 py-3.5">
                          <span className={`flex items-center gap-1.5 font-bold text-xs ${
                            item.status === 'Pending' ? 'text-amber-600' :
                            item.status === 'Syncing' ? 'text-blue-600' : 'text-rose-600'
                          }`}>
                            {item.status === 'Pending' ? <Clock className="w-3.5 h-3.5" /> :
                             item.status === 'Syncing' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> :
                             <AlertCircle className="w-3.5 h-3.5" />}
                            {item.status}
                            {item.retryCount > 0 && <span className="text-slate-400 dark:text-[#64916e] font-normal">(×{item.retryCount})</span>}
                          </span>
                          {item.error && (
                            <div className="text-[10px] text-rose-400 mt-0.5 truncate" title={item.error}>
                              {item.error}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {item.status === 'Failed' && (
                            <button
                              onClick={() => handleRetryItem(item.id)}
                              disabled={actionInProgress || syncing}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1.5 rounded-md transition-colors disabled:opacity-50"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {queue.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalItems={queue.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={setItemsPerPage}
                  itemLabel="records"
                />
              )}
            </div>
          </>
        )}
      </div>

      {isRestoreModalOpen && (
        <RestoreCloudDataModal
          onClose={() => setIsRestoreModalOpen(false)}
          onSuccess={async (msg) => {
            setSuccessMsg(msg);
            await loadData();
          }}
          pendingCount={statusData?.pendingCount ?? 0}
          failedCount={statusData?.failedCount ?? 0}
        />
      )}
    </div>
  );
};
