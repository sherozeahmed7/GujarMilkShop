import React, { useState } from 'react';
import { PlusCircle, BookOpen } from 'lucide-react';
import { CashPerson } from '../../types/cashbook';
import { CashbookSummaryCards } from '../../components/cashbook/CashbookSummaryCards';
import { CashPersonTable } from '../../components/cashbook/CashPersonTable';
import { TransactionHistory } from '../../components/cashbook/TransactionHistory';
import { AddCashPersonModal } from '../../components/cashbook/AddCashPersonModal';
import { AmountModal } from '../../components/cashbook/AmountModal';
import { DisablePersonModal } from '../../components/cashbook/DisablePersonModal';
import toast from 'react-hot-toast';

export const Cashbook: React.FC = () => {
  /**
   * refreshKey is incremented after any mutation to trigger all child
   * components to re-fetch data from the service layer.
   */
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => setRefreshKey((k) => k + 1);

  // Modal state
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [amountTarget, setAmountTarget] = useState<CashPerson | null>(null);
  const [disableTarget, setDisableTarget] = useState<CashPerson | null>(null);

  const handlePersonCreated = () => {
    setShowAddPerson(false);
    toast.success('Cash person created successfully.');
    refresh();
  };

  const handleTransactionAdded = () => {
    setAmountTarget(null);
    toast.success('Transaction recorded successfully.');
    refresh();
  };

  const handleDisableSuccess = () => {
    const wasDisabling = disableTarget?.status === 'Active';
    setDisableTarget(null);
    toast.success(wasDisabling ? 'Cash person disabled.' : 'Cash person re-enabled.');
    refresh();
  };

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Page Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm shadow-blue-600/30">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cashbook</h1>
          </div>
          <p className="text-sm text-slate-500 ml-10.5">
            Track money received from and paid to other people.
          </p>
          <div className="mt-2 ml-10.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
            <span>⚠</span> Cashbook is informational only — does not affect Cash Register, Sales, or Profit &amp; Loss.
          </div>
        </div>
        <button
          id="cashbook-add-person-btn"
          onClick={() => setShowAddPerson(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold rounded-xl shadow-sm shadow-blue-600/20 transition-all shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          Add Cash Person
        </button>
      </div>

      {/* Summary Cards */}
      <CashbookSummaryCards refreshKey={refreshKey} />

      {/* Cash Person Table */}
      <CashPersonTable
        refreshKey={refreshKey}
        onAmountClick={setAmountTarget}
        onDisableClick={setDisableTarget}
      />

      {/* Transaction History */}
      <TransactionHistory refreshKey={refreshKey} />

      {/* ─── Modals ─── */}
      {showAddPerson && (
        <AddCashPersonModal
          onClose={() => setShowAddPerson(false)}
          onSuccess={handlePersonCreated}
        />
      )}

      {amountTarget && (
        <AmountModal
          person={amountTarget}
          onClose={() => setAmountTarget(null)}
          onSuccess={handleTransactionAdded}
        />
      )}

      {disableTarget && (
        <DisablePersonModal
          person={disableTarget}
          onClose={() => setDisableTarget(null)}
          onSuccess={handleDisableSuccess}
        />
      )}
    </div>
  );
};
