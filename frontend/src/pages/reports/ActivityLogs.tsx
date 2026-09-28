import React, { useState, useEffect } from 'react';
import { activityLogger, ActivityLogEntry } from '../../services/activityLogger';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, ErrorState } from '../../components/reports/ReportStates';
import { Activity, AlertTriangle, CheckCircle, XCircle, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { Pagination } from '../../components/common/Pagination';

const STATUS_STYLES: Record<string, string> = {
  'Success': 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  'Warning': 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400',
  'Error': 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400',
};

const MODULES = ['All', 'Sales', 'Inventory', 'Customers', 'Suppliers', 'Shifts', 'Expenses', 'Returns', 'Backup', 'Cashbook', 'Users & Roles'];
const PAGE_SIZE = 25;

export const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  // Summary totals fetched independently via server-side counts
  const [successCount, setSuccessCount] = useState(0);
  const [warningCount, setWarningCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const loadLogs = async (page: number) => {
    setIsLoading(true); setError(null);
    try {
      const result = await activityLogger.getLogs({
        page,
        pageSize: PAGE_SIZE,
        search: searchTerm,
        module: moduleFilter,
        status: statusFilter,
      });
      setLogs(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (e) {
      setError('Failed to load activity logs.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSummaryCounts = async () => {
    try {
      const [successRes, warningRes, errorRes] = await Promise.all([
        activityLogger.getLogs({ page: 1, pageSize: 1, status: 'Success' }),
        activityLogger.getLogs({ page: 1, pageSize: 1, status: 'Warning' }),
        activityLogger.getLogs({ page: 1, pageSize: 1, status: 'Error' }),
      ]);
      setSuccessCount(successRes.total);
      setWarningCount(warningRes.total);
      setErrorCount(errorRes.total);
    } catch {}
  };

  // Reload when filters change — reset to page 1
  useEffect(() => {
    setCurrentPage(1);
    loadLogs(1);
    loadSummaryCounts();
  }, [searchTerm, moduleFilter, statusFilter]);

  // Reload when page changes (but not when filter state changes — that already resets page to 1)
  useEffect(() => {
    loadLogs(currentPage);
  }, [currentPage]);

  const handlePageChange = (page: number) => setCurrentPage(page);

  return (
    <ReportLayout>
      <ReportHeader
        title="Activity Logs"
        description="Complete audit trail of all actions performed in the POS system."
        exportData={logs}
        exportColumns={[
          { header: 'Timestamp', dataKey: 'timestamp' }, { header: 'User', dataKey: 'user' },
          { header: 'Role', dataKey: 'userRole' }, { header: 'Module', dataKey: 'module' },
          { header: 'Action', dataKey: 'action' }, { header: 'Description', dataKey: 'description' },
          { header: 'Status', dataKey: 'status' }
        ]}
        exportSummary={{
          totalEvents: total,
          successful: successCount,
          warnings: warningCount,
          errors: errorCount,
        }}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard title="Total Events" value={total} icon={Activity} />
        <SummaryCard title="Successful" value={successCount} icon={CheckCircle} valueColor="text-emerald-600 dark:text-emerald-400" />
        <SummaryCard title="Warnings" value={warningCount} icon={AlertTriangle} valueColor="text-amber-600 dark:text-amber-400" />
        <SummaryCard title="Errors" value={errorCount} icon={XCircle} valueColor="text-rose-600 dark:text-rose-400" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#1a2e1f] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35]">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#64916e] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-[#2d4a35] rounded-lg bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={e => setModuleFilter(e.target.value)}
          className="py-2 px-3 text-sm border border-slate-200 dark:border-[#2d4a35] rounded-lg bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MODULES.map(m => <option key={m} value={m}>{m === 'All' ? 'All Modules' : m}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="py-2 px-3 text-sm border border-slate-200 dark:border-[#2d4a35] rounded-lg bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Statuses</option>
          <option value="Success">Success</option>
          <option value="Warning">Warning</option>
          <option value="Error">Error</option>
        </select>
        <button
          onClick={() => { setCurrentPage(1); loadLogs(1); loadSummaryCounts(); }}
          disabled={isLoading}
          className="p-2 border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124] rounded-lg transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={() => loadLogs(currentPage)} />}

      {!isLoading && !error && (
        <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Activity Log</h3>
              <p className="text-xs text-slate-400 dark:text-[#64916e] mt-0.5">{total} entries found</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => p - 1)}
                className="p-1.5 rounded border border-slate-200 dark:border-[#2d4a35] text-slate-500 dark:text-[#8ba895] disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-slate-600 dark:text-[#a7c4ae]">Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="p-1.5 rounded border border-slate-200 dark:border-[#2d4a35] text-slate-500 dark:text-[#8ba895] disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0 z-10 shadow-sm">
                <tr>
                  {['Timestamp', 'User', 'Module', 'Action', 'Description', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 dark:text-[#64916e] text-sm">
                      No activity logs found.
                    </td>
                  </tr>
                ) : logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-[#8ba895] whitespace-nowrap">
                      <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                      <div className="text-slate-400 dark:text-[#64916e]">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-700 dark:text-[#e2f5e8]">{log.user}</div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{log.userRole}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#142119] text-slate-600 dark:text-[#a7c4ae] rounded text-xs font-medium">{log.module}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-[#e2f5e8]">{log.action}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae] max-w-[280px]">
                      <p className="truncate" title={log.description}>{log.description}</p>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[log.status] || STATUS_STYLES['Warning']}`}>{log.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={total}
              itemsPerPage={PAGE_SIZE}
              onPageChange={handlePageChange}
              itemLabel="logs"
            />
          )}
        </div>
      )}
    </ReportLayout>
  );
};
