import React, { useState, useEffect } from 'react';
import { getBackupReport } from '../../services/reportsApi';
import { createBackup, deleteBackup, restoreBackup } from '../../services/backupService';
import { ReportLayout } from '../../components/reports/ReportLayout';
import { ReportHeader } from '../../components/reports/ReportHeader';
import { SummaryCard } from '../../components/reports/SummaryCard';
import { LoadingState, EmptyState, ErrorState } from '../../components/reports/ReportStates';
import { Pagination } from '../../components/common/Pagination';
import { Database, CheckCircle, Clock, AlertTriangle, HardDrive, Download, RefreshCw, Trash2, Search } from 'lucide-react';

export const BackupReport: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadReport = async () => {
    setIsLoading(true); setError(null);
    try {
      const result = await getBackupReport();
      setData(result);
    } catch (e: any) {
      setError(e?.message || 'Failed to load Backup report.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, []);

  const handleCreateBackup = async () => {
    try {
      setIsLoading(true);
      await createBackup();
      setActionMessage('Backup created successfully.');
      setTimeout(() => setActionMessage(null), 4000);
      await loadReport();
    } catch (err: any) {
      setError(err?.message || 'Failed to create backup.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!window.confirm(`Are you sure you want to delete backup "${filename}"?`)) return;
    try {
      setIsLoading(true);
      await deleteBackup(filename);
      setActionMessage('Backup deleted successfully.');
      setTimeout(() => setActionMessage(null), 4000);
      await loadReport();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete backup.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!window.confirm(`WARNING: Restoring backup "${filename}" will overwrite the local database. Proceed?`)) return;
    try {
      setIsLoading(true);
      await restoreBackup(filename);
      alert('Backup restored successfully. The application will now reload.');
      window.location.reload();
    } catch (err: any) {
      setError(err?.message || 'Failed to restore backup.');
      setIsLoading(false);
    }
  };

  const handleDownload = (filename: string) => {
    const url = `http://localhost:5000/api/backup/download/${encodeURIComponent(filename)}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const filtered = (data?.backups || []).filter((b: any) =>
    (b.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (b.fileName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <ReportLayout>
      <ReportHeader
        title="Backup Report"
        description="History of all database backups, sizes, and restore points."
        exportData={filtered}
        exportColumns={[
          { header: 'ID', dataKey: 'id' }, { header: 'File Name', dataKey: 'fileName' },
          { header: 'Date', dataKey: 'date' }, { header: 'Type', dataKey: 'type' },
          { header: 'Size', dataKey: 'size' }, { header: 'Location', dataKey: 'location' },
          { header: 'Status', dataKey: 'status' }
        ]}
      />

      {actionMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-400 px-4 py-2 rounded-lg text-sm font-medium">
          {actionMessage}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-[#1a2e1f] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35]">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 dark:text-[#64916e] absolute left-3 top-1/2 -translate-y-1/2" />
          <input type="text" placeholder="Search backups..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-[#2d4a35] rounded-lg bg-white dark:bg-[#142119] text-slate-800 dark:text-[#e2f5e8] focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={loadReport} disabled={isLoading} className="p-2 border border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124] rounded-lg transition-colors">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={loadReport} />}

      {!isLoading && !error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <SummaryCard title="Total Backups" value={data.summary.totalBackups} icon={Database} />
            <SummaryCard title="Successful" value={data.summary.successfulBackups} icon={CheckCircle} valueColor="text-emerald-600 dark:text-emerald-400" />
            <SummaryCard title="Failed" value={data.summary.failedBackups} icon={AlertTriangle} valueColor="text-rose-600 dark:text-rose-400" />
            <SummaryCard title="Last Backup" value={data.summary.latestBackup} icon={Clock} />
            <SummaryCard title="Total Storage" value={data.summary.totalStorage} icon={HardDrive} valueColor="text-blue-600 dark:text-blue-400" />
            <SummaryCard title="Frequency" value={data.summary.backupFrequency} icon={Clock} />
          </div>

          <div className="bg-white dark:bg-[#1a2e1f] rounded-xl shadow-sm border border-slate-200 dark:border-[#2d4a35] overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-[#2d4a35] flex items-center justify-between">
              <h3 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Backup History</h3>
              <button onClick={handleCreateBackup} className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors">
                Create Backup Now
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-slate-50 dark:bg-[#142119] sticky top-0">
                  <tr>
                    {['Backup ID', 'File Name', 'Date & Time', 'Type', 'Size', 'Location', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400 dark:text-[#64916e] text-sm">No backups found.</td></tr>
                  )}
                  {filtered
                    .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                    .map((b: any) => (
                    <tr key={b.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-blue-600 dark:text-blue-400">{b.id}</td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-[#e2f5e8] font-mono text-xs">{b.fileName}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae]">
                        <div>{b.date}</div>
                        <div className="text-xs text-slate-400 dark:text-[#64916e]">{b.time}</div>
                      </td>
                      <td className="px-4 py-3 text-sm"><span className={`px-2 py-0.5 rounded text-xs font-medium ${b.type === 'Full' || b.type === 'Manual' ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400' : 'bg-slate-100 dark:bg-[#142119] text-slate-600 dark:text-[#a7c4ae]'}`}>{b.type}</span></td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-700 dark:text-[#e2f5e8]">{b.size}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-[#a7c4ae] truncate max-w-[200px]" title={b.location}>{b.location}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${b.status === 'Success' ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400'}`}>{b.status}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          {b.status === 'Success' && (
                            <>
                              <button onClick={() => handleRestoreBackup(b.fileName)} className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium" title="Restore this backup">Restore</button>
                              <button onClick={() => handleDownload(b.fileName)} className="text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae]" title="Download backup file"><Download className="w-4 h-4" /></button>
                            </>
                          )}
                          <button onClick={() => handleDeleteBackup(b.fileName)} className="text-rose-400 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300" title="Delete backup"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {filtered.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filtered.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
                itemLabel="backups"
              />
            )}
          </div>
        </>
      )}
      {!isLoading && !error && !data && <EmptyState onRefresh={loadReport} />}
    </ReportLayout>
  );
};
