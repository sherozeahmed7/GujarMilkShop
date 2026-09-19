import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (itemsPerPage: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  itemLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  itemsPerPage = 25,
  onPageChange,
  onItemsPerPageChange,
  pageSizeOptions = [25, 50, 100],
  className = '',
  itemLabel = 'records',
}) => {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const pageStart = (safePage - 1) * itemsPerPage;
  const pageEnd = Math.min(pageStart + itemsPerPage, totalItems);

  // Generate page numbers with ellipsis
  const getPageNumbers = (): (number | '...')[] => {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
      .reduce<(number | '...')[]>((acc, p, idx, arr) => {
        if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
          acc.push('...');
        }
        acc.push(p);
        return acc;
      }, []);
  };

  return (
    <div
      className={`px-4 py-3 border-t border-slate-100 bg-slate-50/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 ${className}`}
    >
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <span className="font-medium text-slate-500">
          Showing <span className="font-bold text-slate-700">{pageStart + 1}</span>–
          <span className="font-bold text-slate-700">{pageEnd}</span> of{' '}
          <span className="font-bold text-slate-800">{totalItems}</span> {itemLabel}
        </span>

        {onItemsPerPageChange && (
          <div className="flex items-center gap-1.5 ml-2">
            <span className="text-slate-400">Rows:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                const newLimit = Number(e.target.value);
                onItemsPerPageChange(newLimit);
                onPageChange(1);
              }}
              className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            className="flex items-center gap-1 px-2.5 py-1.5 font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            title="Previous Page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <div className="flex items-center gap-1">
            {getPageNumbers().map((p, idx) =>
              p === '...' ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 font-bold">
                  …
                </span>
              ) : (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => onPageChange(p as number)}
                  className={`min-w-[30px] h-[30px] px-2 flex items-center justify-center font-bold rounded-lg border transition-all ${
                    safePage === p
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/30'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 shadow-sm'
                  }`}
                >
                  {p}
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
            className="flex items-center gap-1 px-2.5 py-1.5 font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
            title="Next Page"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
