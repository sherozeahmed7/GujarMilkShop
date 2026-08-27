import React, { useState, useEffect } from 'react';
import { RegisterHeader } from '../components/register/RegisterHeader';
import { CashCountAudit } from '../components/register/CashCountAudit';
import { SummaryCards } from '../components/register/SummaryCards';
import { ExpectedCashCard } from '../components/register/ExpectedCashCard';
import { ZReportSection } from '../components/register/ZReportSection';
import { CountCashModal } from '../components/register/CountCashModal';
import { CloseConfirmModal } from '../components/register/CloseConfirmModal';
import { useRegisterStore } from '../store/registerStore';

export const CashRegister: React.FC = () => {
  const { currentRegister, fetchShifts, isLoading, error } = useRegisterStore();
  const [showCountModal, setShowCountModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  useEffect(() => { fetchShifts(); }, []);

  const handleCloseRequest = () => {
    if (!currentRegister) return;
    if (currentRegister.status === 'OPEN') {
      setShowCountModal(true);
    } else {
      setShowCloseModal(true);
    }
  };

  const handleCountSaved = () => {
    setTimeout(() => setShowCloseModal(true), 100);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-slate-400 text-sm">
        Loading shift data…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-3">
        <p className="text-rose-600 font-medium text-sm">{error}</p>
        <button
          onClick={fetchShifts}
          className="text-blue-600 hover:text-blue-700 font-medium text-sm"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!currentRegister) {
    return (
      <div className="flex flex-col h-full gap-6 min-h-0">
        <div className="flex-shrink-0">
          <RegisterHeader onCloseRegisterRequest={handleCloseRequest} />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <p className="text-slate-600 font-semibold">No active shift found.</p>
            <p className="text-slate-400 text-sm">Open a shift from the Shifts page to start the register.</p>
          </div>
        </div>
        <ZReportSection />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-6 min-h-0">
      <div className="flex-shrink-0">
        <RegisterHeader onCloseRegisterRequest={handleCloseRequest} />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pb-6">
        <CashCountAudit onCountCashClick={() => setShowCountModal(true)} />
        <SummaryCards />
        <ExpectedCashCard />
        <ZReportSection />
      </div>

      {showCountModal && (
        <CountCashModal
          onClose={() => setShowCountModal(false)}
          onSaved={handleCountSaved}
        />
      )}

      {showCloseModal && (
        <CloseConfirmModal onClose={() => setShowCloseModal(false)} />
      )}
    </div>
  );
};
