import React, { useState, useEffect, useMemo } from 'react';
import { activityLogger, ActivityLogEntry } from '../../services/activityLogger';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, ErrorState } from '../../components/reports/ReportStates';
import { Activity, AlertTriangle, CheckCircle, XCircle, Search, RefreshCw, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  'Success': 'bg-emerald-100 text-emerald-700',
  'Warning': 'bg-amber-100 text-amber-700',
  'Error': 'bg-rose-100 text-rose-700',
};

const MODULES = ['All', 'Sales', 'Inventory', 'Daily Rates', 'Customers', 'Suppliers', 'Shifts', 'Expenses', 'Returns', 'Backup'];
const ITEMS_PER_PAGE = 15;

export const ActivityLogs: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);

  const loadLogs = async () => {
    setIsLoading(true); setError(null);
    try {
      const data = await activityLogger.getLogs();
      setLogs(data);
    } catch (e) {
      setError('Failed to load activity logs.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearLogs = async () => {
    if (window.confirm('Are you sure you want to clear all activity logs? This cannot be undone.')) {
      await activityLogger.clearLogs();
      setLogs([]);
      setCurrentPage(1);
    }
  };

  useEffect(() => { loadLogs(); }, []);

  const filtered = useMemo(() => {
    return logs.filter(l => {
      const matchSearch = l.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.user.toLowerCase().includes(searchTerm.toLowerCase());
      const matchModule = moduleFilter === 'All' || l.module === moduleFilter;
      const matchStatus = statusFilter === 'All' || l.status === statusFilter;
      return matchSearch && matchModule && matchStatus;
    });
  }, [logs, searchTerm, moduleFilter, statusFilter]);

  // Pagination logic
  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const paginatedLogs = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const successCount = logs.filter(l => l.status === 'Success').length;
  const warningCount = logs.filter(l => l.status === 'Warning').length;
  const errorCount = logs.filter(l => l.status === 'Error').length;

  return (
    <ReportLayout>
      <ReportHeader
        title="Activity Logs"
        description="Complete audit trail of all actions performed in the POS system."
        exportData={filtered}
        exportColumns={[
          { header: 'Timestamp', dataKey: 'timestamp' }, { header: 'User', dataKey: 'user' },
          { header: 'Role', dataKey: 'userRole' }, { header: 'Module', dataKey: 'module' },
          { header: 'Action', dataKey: 'action' }, { header: 'Description', dataKey: 'description' },
          { header: 'Status', dataKey: 'status' }
        ]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard title="Total Events" value={logs.length} icon={Activity} />
        <SummaryCard title="Successful" value={successCount} icon={CheckCircle} valueColor="text-emerald-600" />
        <SummaryCard title="Warnings" value={warningCount} icon={AlertTriangle} valueColor="text-amber-600" />
        <SummaryCard title="Errors" value={errorCount} icon={XCircle} valueColor="text-rose-600" />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search logs..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={moduleFilter} onChange={e => { setModuleFilter(e.target.value); setCurrentPage(1); }}
          className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          {MODULES.map(m => <option key={m} value={m}>{m === 'All' ? 'All Modules' : m}</option>)}
        </select>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          className="py-2 px-3 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="All">All Statuses</option>
          <option value="Success">Success</option>
          <option value="Warning">Warning</option>
          <option value="Error">Error</option>
        </select>
        <button onClick={loadLogs} disabled={isLoading} className="p-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
        <button onClick={handleClearLogs} className="flex items-center gap-2 px-3 py-2 text-sm text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors">
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Clear Logs</span>
        </button>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadLogs} />}

      {!isLoading && !error && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col h-[600px]">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-800">Activity Log</h3>
              <p className="text-xs text-slate-400 mt-0.5">{filtered.length} entries found</p>
            </div>
            <div className="flex items-center gap-2">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 rounded border border-slate-200 text-slate-500 disabled:opacity-50 hover:bg-slate-50 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-medium text-slate-600">Page {currentPage} of {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 rounded border border-slate-200 text-slate-500 disabled:opacity-50 hover:bg-slate-50 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  {['Timestamp', 'User', 'Module', 'Action', 'Description', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm">
                      No activity logs found.
                    </td>
                  </tr>
                ) : paginatedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                      <div>{new Date(log.timestamp).toLocaleDateString()}</div>
                      <div className="text-slate-400">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-700">{log.user}</div>
                      <div className="text-xs text-blue-600 font-semibold">{log.userRole}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">{log.module}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">{log.action}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[280px]">
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
        </div>
      )}
    </ReportLayout>
  );
};
