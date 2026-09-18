import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, BookOpen, Phone, MapPin, BadgeCheck, Tag,
  ArrowDownToLine, ArrowUpFromLine, Wallet
} from 'lucide-react';
import { CashPerson, CashPersonLedgerEntry } from '../../types/cashbook';
import { getCashPersonById, getCashPersonLedger, getCashbookTransactions } from '../../services/cashbook.service';
import { CashbookTransaction } from '../../types/cashbook';

const fmt = (n: number) => `Rs. ${(isNaN(n) || !isFinite(n) ? 0 : Math.round(n)).toLocaleString()}`;

const fmtDate = (dateStr: string) => {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-PK', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch { return dateStr; }
};

export const CashPersonLedger: React.FC = () => {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();

  const [person, setPerson] = useState<CashPerson | null>(null);
  const [entries, setEntries] = useState<CashPersonLedgerEntry[]>([]);
  const [allTxns, setAllTxns] = useState<CashbookTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!personId) return;
    setIsLoading(true);
    Promise.all([
      getCashPersonById(personId),
      getCashPersonLedger(personId),
      getCashbookTransactions({ personId }),
    ]).then(([p, e, t]) => {
      if (!p) { setError('Cash person not found.'); setIsLoading(false); return; }
      setPerson(p);
      setEntries(e);
      setAllTxns(t);
      setIsLoading(false);
    });
  }, [personId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3" />
        <span className="text-sm text-slate-500">Loading ledger…</span>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-rose-600 font-semibold text-sm">{error || 'Person not found.'}</p>
        <button onClick={() => navigate('/register/cashbook')} className="text-blue-600 text-sm hover:underline">
          ← Back to Cashbook
        </button>
      </div>
    );
  }

  const isActive = person.status === 'Active';
  const totalReceived = allTxns.filter(t => t.transactionType === 'Receive Amount').reduce((s, t) => s + t.amount, 0);
  const totalPaid = allTxns.filter(t => t.transactionType === 'Pay Amount').reduce((s, t) => s + t.amount, 0);
  const currentBalance = entries.length > 0 ? entries[entries.length - 1].runningBalance : person.openingBalance;

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/register/cashbook')}
        className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors w-fit"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Cashbook
      </button>

      {/* Person Info Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          {/* Avatar + Name */}
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0 ${person.type === 'Incoming' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
              {person.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">{person.name}</h1>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-lg uppercase tracking-wide ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {person.status}
                </span>
              </div>
              {person.description && (
                <p className="text-sm text-slate-500 mt-0.5">{person.description}</p>
              )}
            </div>
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-3 sm:ml-auto text-sm">
            {person.phone && (
              <span className="flex items-center gap-1.5 text-slate-600">
                <Phone className="w-4 h-4 text-slate-400" /> {person.phone}
              </span>
            )}
            {person.address && (
              <span className="flex items-center gap-1.5 text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400" /> {person.address}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-slate-600">
              <Tag className="w-4 h-4 text-slate-400" />
              <span className={`font-semibold ${person.type === 'Incoming' ? 'text-blue-600' : 'text-rose-600'}`}>{person.type}</span>
            </span>
            <span className="flex items-center gap-1.5 text-slate-600">
              <BadgeCheck className="w-4 h-4 text-slate-400" />
              <span className={`font-semibold ${person.customerType === 'Debtor' ? 'text-amber-600' : 'text-violet-600'}`}>
                {person.customerType === 'Debtor' ? 'They Owe Us' : 'We Owe Them'}
              </span>
            </span>
          </div>
        </div>

        {/* Balance Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-100">
          <BalanceItem label="Opening Balance" value={fmt(person.openingBalance)} color="text-slate-700" icon={Wallet} />
          <BalanceItem label="Total Received" value={fmt(totalReceived)} color="text-emerald-600" icon={ArrowDownToLine} />
          <BalanceItem label="Total Paid" value={fmt(totalPaid)} color="text-rose-500" icon={ArrowUpFromLine} />
          <BalanceItem
            label={`Current ${person.type === 'Incoming' ? 'To Receive' : 'To Pay'}`}
            value={currentBalance === 0 ? 'Settled ✓' : fmt(currentBalance)}
            color={currentBalance === 0 ? 'text-emerald-600' : person.type === 'Incoming' ? 'text-blue-600' : 'text-rose-600'}
            icon={BookOpen}
          />
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-500" />
            Transaction Ledger
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">{entries.length} entries — complete and unmodifiable history.</p>
        </div>

        <div className="overflow-x-auto">
          {entries.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-500">No transactions yet.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-5 py-3">Date</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3">Amount In</th>
                  <th className="text-right px-4 py-3">Amount Out</th>
                  <th className="text-right px-4 py-3">Balance</th>
                  <th className="text-left px-4 py-3">Recorded By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {entries.map((entry, idx) => {
                  const isOpening = entry.transactionType === 'Opening Balance';
                  const isIn = entry.amountIn > 0;
                  return (
                    <tr key={entry.id} className={`hover:bg-slate-50/60 transition-colors ${idx === 0 ? 'bg-slate-50/30' : ''}`}>
                      <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap text-xs">{fmtDate(entry.date)}</td>
                      <td className="px-4 py-3.5 text-slate-700 max-w-[200px]">
                        <span className="block truncate">{entry.description}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${
                          isOpening ? 'bg-slate-100 text-slate-600' :
                          isIn ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
                        }`}>
                          {entry.transactionType}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-emerald-600 whitespace-nowrap">
                        {entry.amountIn > 0 ? fmt(entry.amountIn) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-rose-500 whitespace-nowrap">
                        {entry.amountOut > 0 ? fmt(entry.amountOut) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className={`font-bold ${entry.runningBalance === 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {entry.runningBalance === 0 ? 'Settled ✓' : fmt(entry.runningBalance)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs whitespace-nowrap">{entry.createdBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

const BalanceItem: React.FC<{
  label: string; value: string; color: string; icon: React.ElementType;
}> = ({ label, value, color, icon: Icon }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
    <span className={`text-lg font-bold ${color}`}>{value}</span>
  </div>
);
