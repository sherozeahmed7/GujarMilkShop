import React from 'react';
import { Search } from 'lucide-react';

interface CustomerToolbarProps {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  filterType: 'All' | 'Dues';
  setFilterType: (val: 'All' | 'Dues') => void;
  duesCount: number;
}

export const CustomerToolbar: React.FC<CustomerToolbarProps> = ({
  searchQuery, setSearchQuery, filterType, setFilterType, duesCount
}) => {
  return (
    <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4 bg-white/50 flex-shrink-0">
      <div className="relative w-full max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input 
          type="text" 
          placeholder="Search by name, phone, or card number..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilterType('All')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
            filterType === 'All' 
              ? 'bg-slate-800 text-white border-slate-800 shadow-sm' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilterType('Dues')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${
            filterType === 'Dues' 
              ? 'bg-slate-800 text-white border-slate-800 shadow-sm' 
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          Dues ({duesCount})
        </button>
        {(searchQuery || filterType !== 'All') && (
          <button
            onClick={() => {
              setSearchQuery('');
              setFilterType('All');
            }}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-white border border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-all ml-1"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
};
