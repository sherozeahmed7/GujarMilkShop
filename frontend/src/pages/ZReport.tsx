import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { ZReportSummaryCard } from '../components/register/ZReportSummaryCard';
import { RegisterHistoryTable } from '../components/register/RegisterHistoryTable';
import { useRegisterStore } from '../store/registerStore';
import { RegisterStatus } from '../types';
import { exportZReportToPdf, exportZReportToExcel } from '../utils/exportUtils';

const statusColors: Record<RegisterStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-700 border-amber-200',
  COUNTED: 'bg-blue-100 text-blue-700 border-blue-200',
  CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const ZReport: React.FC = () => {
  const { currentRegister, registerHistory, fetchShifts } = useRegisterStore();
  const navigate = useNavigate();

  useEffect(() => { fetchShifts(); }, []);

  // Inject print styles
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-zreport-style';
    style.innerHTML = `
      @media print {
        body * { visibility: hidden; }
        #z-report-printable-area, #z-report-printable-area * { visibility: visible; }
        #z-report-printable-area { position: absolute; left: 0; top: 0; width: 100%; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('print-zreport-style');
      if (el) el.remove();
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const display = currentRegister ?? registerHistory[0] ?? null;

  const handleExportPdf = async () => {
    if (!display) return;
    await exportZReportToPdf(display, registerHistory);
  };

  const handleExportExcel = async () => {
    if (!display) return;
    await exportZReportToExcel(display, registerHistory);
  };

  return (
    <div className="flex flex-col h-full gap-6 min-h-0">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 flex-shrink-0">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/register')}
            className="mt-1 p-2 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#223927] rounded-lg text-slate-500 dark:text-[#86efac] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-[#e2f5e8] tracking-tight">Z-Report / End of Day Closing</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              {display ? `Accountant-ready closing summary for ${display.date}` : 'No shift data available'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {display && (
            <span className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest border ${statusColors[display.status]}`}>
              {display.status}
            </span>
          )}
          <div className="w-px h-8 bg-slate-200 dark:bg-[#2d4a35] mx-1"></div>
          <button
            onClick={handleExportExcel}
            disabled={!display}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#223927] text-slate-700 dark:text-[#e2f5e8] text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-[#22c55e]" />Excel
          </button>
          <button
            onClick={handleExportPdf}
            disabled={!display}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-[#1a2e1f] border border-slate-200 dark:border-[#2d4a35] hover:bg-slate-50 dark:hover:bg-[#223927] text-slate-700 dark:text-[#e2f5e8] text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            <FileText className="w-4 h-4 text-rose-500" />PDF
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 dark:bg-[#22c55e] hover:bg-slate-900 dark:hover:bg-[#1ea34d] text-white dark:text-[#0d1a10] text-sm font-semibold rounded-xl shadow-sm transition-all">
            <Printer className="w-4 h-4" />Print Z-Report
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pb-6" id="z-report-printable-area">
        {display ? <ZReportSummaryCard data={display} /> : (
          <div className="text-center text-slate-400 text-sm py-16">No shift data to display.</div>
        )}
        <RegisterHistoryTable />
      </div>
    </div>
  );
};
