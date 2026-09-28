import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, FileText, Banknote, Loader2 } from 'lucide-react';
import { customerMilkReportService } from '../../services/customerMilkReportService';
import { MonthlyStatement, CalculatedStatement } from '../../types/customerMilkReport';
import { MilkCalendarGrid } from './MilkCalendarGrid';
import { StatementSummaryCards } from './StatementSummaryCards';
import { PaymentHistoryTable } from './PaymentHistoryTable';
import { ReceivePaymentModal } from './ReceivePaymentModal';
import toast from 'react-hot-toast';

interface Props {
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  onBack: () => void;
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export const CustomerMonthlyStatement: React.FC<Props> = ({
  customerId, customerName, customerPhone, onBack,
}) => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [stmt, setStmt] = useState<MonthlyStatement | null>(null);
  const [calc, setCalc] = useState<CalculatedStatement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const loadStatement = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await customerMilkReportService.getCustomerMonthlyStatement(
        customerId, customerName, customerPhone, month, year,
      );
      const calculated = customerMilkReportService.calculateMonthlyBalance(data);
      setStmt(data);
      setCalc(calculated);
    } catch (err) {
      toast.error('Failed to load monthly statement.');
    } finally {
      setIsLoading(false);
    }
  }, [customerId, customerName, customerPhone, month, year]);

  useEffect(() => { loadStatement(); }, [loadStatement]);

  const goToPrevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };

  const goToNextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const handleGeneratePDF = async () => {
    if (!stmt || !calc) return;
    setIsGeneratingPDF(true);
    try {
      toast.loading('Generating PDF...', { id: 'pdf-toast' });
      await customerMilkReportService.generateStatementPDF(stmt, calc);
      toast.success('PDF downloaded!', { id: 'pdf-toast' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate PDF.', { id: 'pdf-toast' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-[#a7c4ae] hover:text-slate-900 dark:hover:text-[#e2f5e8] font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Customers
        </button>

        <div className="flex-1" />

        {/* Month navigator */}
        <div className="flex items-center gap-2 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] rounded-lg px-1 py-1 shadow-sm">
          <button
            onClick={goToPrevMonth}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-[#a7c4ae]" />
          </button>
          <span className="text-sm font-semibold text-slate-800 dark:text-[#e2f5e8] px-2 min-w-[130px] text-center">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            onClick={goToNextMonth}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-[#a7c4ae]" />
          </button>
        </div>

        <button
          onClick={handleGeneratePDF}
          disabled={isGeneratingPDF || !stmt}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          {isGeneratingPDF
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <FileText className="w-4 h-4" />}
          Generate PDF
        </button>

        <button
          onClick={() => setShowPaymentModal(true)}
          disabled={!stmt || !calc || (calc?.remaining ?? 0) <= 0}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors disabled:opacity-50"
        >
          <Banknote className="w-4 h-4" />
          Receive Payment
        </button>
      </div>

      {/* Customer heading */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-800 dark:text-[#e2f5e8]">{customerName}</h2>
        {customerPhone && (
          <p className="text-sm text-slate-500 dark:text-[#8ba895]">{customerPhone}</p>
        )}
        <p className="text-sm text-slate-400 dark:text-[#64916e] mt-0.5">
          Monthly Milk Statement — {MONTH_NAMES[month]} {year}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center h-48 text-slate-400 dark:text-[#64916e] gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading statement...</span>
        </div>
      )}

      {!isLoading && stmt && calc && (
        <>
          {/* Summary Cards */}
          <StatementSummaryCards stmt={stmt} calc={calc} />

          {/* Calendar grid */}
          <div className="mb-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-[#a7c4ae] mb-3">
              Daily Milk — {MONTH_NAMES[month]} {year}
            </h3>
            <MilkCalendarGrid month={month} year={year} dailyEntries={stmt.dailyEntries} />
          </div>

          {/* Payment History */}
          <PaymentHistoryTable payments={stmt.payments} />

          <div className="h-6" />
        </>
      )}

      {/* Payment Modal */}
      {showPaymentModal && stmt && calc && (
        <ReceivePaymentModal
          stmt={stmt}
          calc={calc}
          onClose={() => setShowPaymentModal(false)}
          onPaymentAdded={loadStatement}
        />
      )}
    </div>
  );
};
