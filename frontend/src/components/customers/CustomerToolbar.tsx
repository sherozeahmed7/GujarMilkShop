import React from 'react';
import { Search } from 'lucide-react';

export type CustomerTypeFilter =
  | 'All'
  | 'daily_ledger'
  | 'monthly_ledger'
  | 'walk_in'
  | 'split';

export type NameSortOrder = 'default' | 'az' | 'za';

interface CustomerToolbarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterType: 'All' | 'Dues';
  setFilterType: (val: 'All' | 'Dues') => void;
  customerTypeFilter: CustomerTypeFilter;
  setCustomerTypeFilter: (val: CustomerTypeFilter) => void;
  nameSort: NameSortOrder;
  setNameSort: (val: NameSortOrder) => void;
  duesCount: number;
}

export const CustomerToolbar: React.FC<CustomerToolbarProps> = ({
  searchQuery,
  setSearchQuery,
  filterType,
  setFilterType,
  customerTypeFilter,
  setCustomerTypeFilter,
  nameSort,
  setNameSort,
  duesCount,
}) => {
  const hasFilters =
    searchQuery || filterType !== 'All' || customerTypeFilter !== 'All' || nameSort !== 'default';

  return (
    <div className="p-4 border-b border-slate-100 dark:border-[#2d4a35] flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white/50 dark:bg-[#1a2e1f]/50 flex-shrink-0">
      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 text-slate-400 dark:text-[#64916e] absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-800 dark:text-[#e2f5e8] focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={customerTypeFilter}
          onChange={(e) =>
            setCustomerTypeFilter(e.target.value as CustomerTypeFilter)
          }
          className="px-3 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#a7c4ae] outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Types</option>
          <option value="daily_ledger">Daily Ledger</option>
          <option value="monthly_ledger">Monthly Ledger</option>
          <option value="walk_in">Walk-in</option>
          <option value="split">Split</option>
        </select>

        <select
          value={nameSort}
          onChange={(e) => setNameSort(e.target.value as NameSortOrder)}
          className="px-3 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-700 dark:text-[#a7c4ae] outline-none focus:ring-2 focus:ring-blue-500"
          title="Sort by name"
        >
          <option value="default">Sort: Recent</option>
          <option value="az">Name A–Z</option>
          <option value="za">Name Z–A</option>
        </select>

        <button
          type="button"
          onClick={() => setFilterType('All')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
            filterType === 'All'
              ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
              : 'bg-white dark:bg-[#142119] text-slate-600 dark:text-[#a7c4ae] border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#1e3124]'
          }`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setFilterType('Dues')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
            filterType === 'Dues'
              ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
              : 'bg-white dark:bg-[#142119] text-slate-600 dark:text-[#a7c4ae] border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#1e3124]'
          }`}
        >
          Dues ({duesCount})
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setFilterType('All');
              setCustomerTypeFilter('All');
              setNameSort('default');
            }}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] text-slate-500 dark:text-[#8ba895] hover:text-slate-700 dark:hover:text-[#a7c4ae] hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-all ml-1"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
