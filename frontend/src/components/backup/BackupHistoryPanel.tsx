import React, { useState, useMemo } from 'react';
import { History, Database, FileSpreadsheet, FileText, Printer, Search, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useBackupStore } from '../../store/backupStore';
import { exportToExcel, exportToPDF } from '../../services/backupService';

const PAGE_SIZE_OPTIONS = [5, 10, 20];

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (mins > 0) return `${mins} min${mins > 1 ? 's' : ''} ago`;
  return 'just now';
}

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export const BackupHistoryPanel: React.FC = () => {
  const { backups } = useBackupStore();

  const [search, setSearch] = useState('');
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const latestBackup = backups[0];
  const latestLabel = latestBackup ? `Latest backup ${formatRelativeTime(latestBackup.createdAt)}` : 'No backups yet';

  // Filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return backups.filter(b =>
      b.filename.toLowerCase().includes(q) ||
      b.path.toLowerCase().includes(q) ||
      new Date(b.createdAt).toLocaleDateString().includes(q)
    );
  }, [backups, search]);

  // Sort
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortDesc ? diff : -diff;
    });
  }, [filtered, sortDesc]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const goTo = (p: number) => setPage(Math.max(1, Math.min(totalPages, p)));

  const handleSearch = (v: string) => {
    setSearch(v);
    setPage(1);
  };

  const handlePrint = () => {
    exportToPDF(sorted);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Backup History</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">{latestLabel}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
              {backups.length} backups
            </span>
            <button onClick={() => exportToExcel(sorted)} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-semibold transition-all">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />Excel
            </button>
            <button onClick={() => exportToPDF(sorted)} className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 rounded-lg text-slate-600 text-xs font-semibold transition-all">
              <FileText className="w-3.5 h-3.5 text-rose-500" />PDF
            </button>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold transition-all">
              <Printer className="w-3.5 h-3.5" />Print
            </button>
          </div>
        </div>

        {/* Search + Sort */}
        <div className="flex gap-2 mt-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Search by filename, date, path..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>
          <button
            onClick={() => { setSortDesc(d => !d); setPage(1); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 text-xs font-semibold transition-all flex-shrink-0"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {sortDesc ? 'Newest First' : 'Oldest First'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0">
            <tr>
              <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Backup File</th>
              <th className="text-right px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Modified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 && (
              <tr>
                <td colSpan={2} className="px-5 py-10 text-center text-slate-500 text-sm">
                  No backups match your search.
                </td>
              </tr>
            )}
            {paginated.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <Database className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate max-w-[280px]">{b.filename}</p>
                      <p className="text-xs text-slate-400 font-mono truncate max-w-[280px] mt-0.5">{b.path}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4 text-right whitespace-nowrap">
                  <p className="text-sm text-slate-600 font-medium">{formatRelativeTime(b.createdAt)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{formatTimestamp(b.createdAt)}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex-shrink-0 border-t border-slate-100 px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <span>
            Showing {sorted.length === 0 ? 0 : (page - 1) * pageSize + 1} to {Math.min(page * pageSize, sorted.length)} of {sorted.length} backups
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => goTo(1)} disabled={page === 1} className="p-1.5 disabled:opacity-30 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronsLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => goTo(page - 1)} disabled={page === 1} className="p-1.5 disabled:opacity-30 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          {/* Page numbers */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
            .reduce<(number | '...')[]>((acc, p, idx, arr) => {
              if (idx > 0 && (arr[idx - 1] as number) + 1 < p) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) => p === '...'
              ? <span key={`ellipsis-${i}`} className="px-2 py-1 text-xs text-slate-400">…</span>
              : (
                <button
                  key={p}
                  onClick={() => goTo(p as number)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${page === p ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  {p}
                </button>
              )
            )
          }
          <button onClick={() => goTo(page + 1)} disabled={page === totalPages} className="p-1.5 disabled:opacity-30 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => goTo(totalPages)} disabled={page === totalPages} className="p-1.5 disabled:opacity-30 hover:bg-slate-100 rounded-lg transition-colors">
            <ChevronsRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>
    </div>
  );
};
