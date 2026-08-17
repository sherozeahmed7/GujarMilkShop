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
  const { currentRegister } = useRegisterStore();
  const [showCountModal, setShowCountModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);

  const handleCloseRequest = () => {
    if (currentRegister.status === 'OPEN') {
      setShowCountModal(true);
    } else if (currentRegister.status === 'COUNTED') {
      setShowCloseModal(true);
    } else {
       setShowCloseModal(true); // Can also just show it, though button disables itself
    }
  };

  const handleCountSaved = () => {
    setTimeout(() => {
      setShowCloseModal(true);
    }, 100);
  };

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
