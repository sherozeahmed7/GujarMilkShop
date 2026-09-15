import React, { useEffect, useState, useRef } from 'react';
import { Search, BookOpen, Banknote, Power, PowerOff, ChevronDown, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CashPerson, CashbookTransaction } from '../../types/cashbook';
import { getCashPersons, getCashbookTransactions } from '../../services/cashbook.service';

interface Props {
  refreshKey: number;
  onAmountClick: (person: CashPerson) => void;
  onDisableClick: (person: CashPerson) => void;
}

const fmt = (n: number) => `Rs. ${(isNaN(n) || !isFinite(n) ? 0 : n).toLocaleString()}`;

const calcBalance = (person: CashPerson, txns: CashbookTransaction[]) => {
  const personTxns = txns.filter(
    (t) => t.cashPersonId === person.id && t.transactionType !== 'Opening Balance'
  );
  const totalReceived = personTxns
    .filter((t) => t.transactionType === 'Receive Amount')
    .reduce((s, t) => s + t.amount, 0);
  const totalPaid = personTxns
    .filter((t) => t.transactionType === 'Pay Amount')
    .reduce((s, t) => s + t.amount, 0);
  const balance =
    person.type === 'Incoming'
      ? Math.max(0, person.openingBalance - totalReceived)
      : Math.max(0, person.openingBalance - totalPaid);
  return { totalReceived, totalPaid, balance };
};

export const CashPersonTable: React.FC<Props> = ({ refreshKey, onAmountClick, onDisableClick }) => {
  const [persons, setPersons] = useState<CashPerson[]>([]);
  const [txns, setTxns] = useState<CashbookTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navigate = useNavigate();

  useEffect(() => {
    setIsLoading(true);
    Promise.all([getCashPersons(), getCashbookTransactions()]).then(([p, t]) => {
      setPersons(p);
      setTxns(t);
      setIsLoading(false);
    });
  }, [refreshKey]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (openMenu) {
        const ref = menuRefs.current[openMenu];
        if (ref && !ref.contains(e.target as Node)) {
          setOpenMenu(null);
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenu]);

  const filtered = persons.filter((p) => {
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.phone || '').toLowerCase().includes(q);
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span className="text-sm text-slate-500">Loading cash persons…</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Table Header */}
      <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            Cash Persons
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{persons.length} total · {persons.filter(p => p.status === 'Active').length} active</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-64"
          />
        </div>
      </div>

      {/* Responsive table wrapper */}
      <div className="overflow-x-auto">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-500">
              {search ? 'No cash persons match your search.' : 'No cash persons yet.'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? 'Try a different name or phone number.' : 'Click "+ Add Cash Person" to get started.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                <th className="text-left px-5 py-3">Name</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-right px-4 py-3">Opening Bal.</th>
                <th className="text-right px-4 py-3">Received</th>
                <th className="text-right px-4 py-3">Paid</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="text-center px-4 py-3">Status</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((person) => {
                const { totalReceived, totalPaid, balance } = calcBalance(person, txns);
                const isActive = person.status === 'Active';
                return (
                  <tr
                    key={person.id}
                    className={`transition-colors hover:bg-slate-50/60 ${!isActive ? 'opacity-60' : ''} ${openMenu === person.id ? 'relative z-10' : ''}`}
                  >
                    {/* Name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${person.type === 'Incoming' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 truncate max-w-[140px]">{person.name}</p>
                          {person.description && (
                            <p className="text-xs text-slate-400 truncate max-w-[140px]">{person.description}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Phone */}
                    <td className="px-4 py-4 text-slate-500">{person.phone || <span className="text-slate-300">—</span>}</td>

                    {/* Type */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${person.type === 'Incoming' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>
                        {person.type}
                      </span>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${person.customerType === 'Debtor' ? 'bg-amber-50 text-amber-700' : 'bg-violet-50 text-violet-700'}`}>
                        {person.customerType}
                      </span>
                    </td>

                    {/* Opening Balance */}
                    <td className="px-4 py-4 text-right font-medium text-slate-700">{fmt(person.openingBalance)}</td>

                    {/* Received */}
                    <td className="px-4 py-4 text-right font-medium text-emerald-600">
                      {totalReceived > 0 ? fmt(totalReceived) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Paid */}
                    <td className="px-4 py-4 text-right font-medium text-rose-500">
                      {totalPaid > 0 ? fmt(totalPaid) : <span className="text-slate-300">—</span>}
                    </td>

                    {/* Balance */}
                    <td className="px-4 py-4 text-right">
                      <span className={`font-bold ${balance === 0 ? 'text-emerald-600' : person.type === 'Incoming' ? 'text-blue-600' : 'text-rose-600'}`}>
                        {balance === 0 ? 'Settled ✓' : fmt(balance)}
                      </span>
                      {balance > 0 && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {person.type === 'Incoming' ? 'to receive' : 'to pay'}
                        </p>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {person.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-4 text-center relative">
                      <div
                        ref={(el) => { menuRefs.current[person.id] = el; }}
                        className="relative inline-block"
                      >
                        <button
                          onClick={() => setOpenMenu(openMenu === person.id ? null : person.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          Actions <ChevronDown className="w-3 h-3" />
                        </button>

                        {openMenu === person.id && (
                          <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-xl ring-1 ring-black/5 border border-slate-200 z-50 overflow-hidden">
                            {/* Ledger */}
                            <button
                              onClick={() => { setOpenMenu(null); navigate(`/register/cashbook/ledger/${person.id}`); }}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <BookOpen className="w-4 h-4 text-blue-500" /> Ledger
                            </button>

                            {/* Amount */}
                            <button
                              onClick={() => { setOpenMenu(null); if (isActive) onAmountClick(person); }}
                              disabled={!isActive}
                              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Banknote className="w-4 h-4 text-emerald-500" /> Amount
                            </button>

                            <div className="border-t border-slate-100" />

                            {/* Disable / Enable */}
                            <button
                              onClick={() => { setOpenMenu(null); onDisableClick(person); }}
                              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold transition-colors ${isActive ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                            >
                              {isActive
                                ? <><PowerOff className="w-4 h-4" /> Disable</>
                                : <><Power className="w-4 h-4" /> Enable</>}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
