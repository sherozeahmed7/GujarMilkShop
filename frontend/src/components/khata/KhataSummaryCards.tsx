import React from 'react';
import { BookOpen, DollarSign, CheckCircle } from 'lucide-react';
import { LedgerSummaryStats } from '../../services/customer.service';

interface KhataSummaryCardsProps {
  summary: LedgerSummaryStats;
  loading?: boolean;
  dateFilterLabel?: string;
  partyMode?: 'customers' | 'suppliers';
  /** Called when user clicks the Collected card — opens breakdown modal */
  onCollectedClick?: () => void;
}

export const KhataSummaryCards: React.FC<KhataSummaryCardsProps> = ({
  summary,
  loading,
  dateFilterLabel = 'Today',
  partyMode = 'customers',
  onCollectedClick,
}) => {
  const formatCurrency = (amount: number) => {
    const n = Math.round(Number(amount) || 0);
    if (n < 0) return `Rs. −${Math.abs(n).toLocaleString()}`;
    return `Rs. ${n.toLocaleString()}`;
  };

  const isSuppliers = partyMode === 'suppliers';

  const collectedOrPaidLabel = (() => {
    const norm = (dateFilterLabel || '').trim().toLowerCase();
    if (isSuppliers) {
      if (norm === 'all time') return 'Total Paid';
      if (norm === 'today') return 'Paid Today';
      if (norm === 'yesterday') return 'Paid Yesterday';
      if (norm === 'this week') return 'Paid This Week';
      if (norm === 'this month') return 'Paid This Month';
      if (norm === 'last month') return 'Paid Last Month';
      if (norm === 'this year') return 'Paid This Year';
      if (norm === 'custom') return 'Paid (Period)';
      return `Paid (${dateFilterLabel})`;
    } else {
      if (norm === 'all time') return 'Total Collected';
      if (norm === 'today') return 'Collected Today';
      if (norm === 'yesterday') return 'Collected Yesterday';
      if (norm === 'this week') return 'Collected This Week';
      if (norm === 'this month') return 'Collected This Month';
      if (norm === 'last month') return 'Collected Last Month';
      if (norm === 'this year') return 'Collected This Year';
      if (norm === 'custom') return 'Collected (Period)';
      return `Collected (${dateFilterLabel})`;
    }
  })();

  const card3Amount = isSuppliers ? (summary.supplierPaid || 0) : summary.collectedToday;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
      {/* Card 1 */}
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 shadow-sm border border-slate-100 dark:border-[#2d4a35] flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
          <BookOpen className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 dark:text-[#64916e] uppercase tracking-wider">
            {isSuppliers ? 'Supplier Accounts' : 'Khata Accounts'}
          </p>
          <h3 className="text-3xl font-bold text-slate-800 dark:text-[#e2f5e8] mt-1">
            {loading ? '…' : isSuppliers ? (summary.supplierAccounts || 0) : summary.khataAccounts}
          </h3>
        </div>
      </div>

      {/* Card 2 */}
      <div className={`bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 shadow-sm border flex items-center gap-4 ${
        isSuppliers ? 'border-amber-100 dark:border-[#2d4a35]' : 'border-rose-100 dark:border-[#2d4a35]'
      }`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isSuppliers ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400'
        }`}>
          <DollarSign className="w-6 h-6" />
        </div>
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider ${
            isSuppliers ? 'text-amber-500' : 'text-rose-400'
          }`}>
            {isSuppliers ? 'Supplier Payables' : 'Total Outstanding'}
          </p>
          <h3 className={`text-2xl font-bold mt-1 ${
            isSuppliers ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'
          }`}>
            {loading ? '…' : formatCurrency(isSuppliers ? (summary.supplierPayables || 0) : summary.totalOutstanding)}
          </h3>
        </div>
      </div>

      {/* Card 3: Collected / Paid (Interactive breakdown modal trigger) */}
      {onCollectedClick ? (
        <button
          type="button"
          onClick={onCollectedClick}
          className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 shadow-sm border border-emerald-100 dark:border-[#2d4a35] flex items-center gap-4 text-left w-full hover:shadow-md hover:ring-2 hover:ring-emerald-300 dark:hover:ring-emerald-700 transition-all cursor-pointer group"
          title={isSuppliers ? 'Click to see supplier payment breakdown' : 'Click to see customer collection breakdown'}
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">{collectedOrPaidLabel}</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {loading ? '…' : formatCurrency(card3Amount)}
            </h3>
            <p className="text-[10px] text-emerald-500 dark:text-emerald-400 mt-0.5 font-medium group-hover:underline">
              {isSuppliers ? 'Click to see who was paid →' : 'Click to see who paid →'}
            </p>
          </div>
        </button>
      ) : (
        <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 shadow-sm border border-emerald-100 dark:border-[#2d4a35] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-emerald-500 uppercase tracking-wider">{collectedOrPaidLabel}</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {loading ? '…' : formatCurrency(card3Amount)}
            </h3>
          </div>
        </div>
      )}

      {/* Card 4 */}
      <div className={`bg-white dark:bg-[#1a2e1f] rounded-2xl p-5 shadow-sm border flex items-center gap-4 ${
        isSuppliers ? 'border-rose-100 dark:border-[#2d4a35]' : 'border-amber-100 dark:border-[#2d4a35]'
      }`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
          isSuppliers ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-500 dark:text-rose-400' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
        }`}>
          {isSuppliers ? <DollarSign className="w-6 h-6" /> : <BookOpen className="w-6 h-6" />}
        </div>
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider ${
            isSuppliers ? 'text-rose-400' : 'text-amber-500'
          }`}>
            {isSuppliers ? 'Customer Outstanding' : 'Supplier Payables'}
          </p>
          <h3
            className={`text-2xl font-bold mt-1 ${
              isSuppliers
                ? 'text-rose-600 dark:text-rose-400'
                : (summary.supplierPayables || 0) < 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-amber-600 dark:text-amber-400'
            }`}
          >
            {loading ? '…' : formatCurrency(isSuppliers ? summary.totalOutstanding : (summary.supplierPayables || 0))}
          </h3>
        </div>
      </div>
    </div>
  );
};
