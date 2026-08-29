import React from 'react';
import { BookOpen, DollarSign, CheckCircle } from 'lucide-react';
import { LedgerSummaryStats } from '../../services/customer.service';

interface KhataSummaryCardsProps {
  summary: LedgerSummaryStats;
  loading?: boolean;
}

export const KhataSummaryCards: React.FC<KhataSummaryCardsProps> = ({
  summary,
  loading,
}) => {
  const formatCurrency = (amount: number) => `Rs. ${Math.round(amount).toLocaleString()}`;

  return (
    <div className="grid grid-cols-3 gap-5">
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khata Accounts</p>
          <h3 className="text-3xl font-bold text-slate-800 mt-1">
            {loading ? '…' : summary.khataAccounts}
          </h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-rose-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 flex-shrink-0">
          <DollarSign className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-rose-400 uppercase tracking-wider">Total Outstanding</p>
          <h3 className="text-2xl font-bold text-rose-600 mt-1">
            {loading ? '…' : formatCurrency(summary.totalOutstanding)}
          </h3>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-emerald-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 flex-shrink-0">
          <CheckCircle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Collected Today</p>
          <h3 className="text-2xl font-bold text-emerald-600 mt-1">
            {loading ? '…' : formatCurrency(summary.collectedToday)}
          </h3>
        </div>
      </div>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-amber-500 uppercase tracking-wider">Supplier Payables</p>
          <h3 className="text-2xl font-bold text-amber-600 mt-1">{loading ? '…' : formatCurrency(summary.supplierPayables || 0)}</h3>
        </div>
      </div>
    </div>
  );
};
