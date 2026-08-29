import React from 'react';
import { Lock, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRegisterStore } from '../../store/registerStore';
import { RegisterStatus } from '../../types';
import { exportRegisterExcel, exportRegisterPDF } from '../../utils/registerExport';

interface RegisterHeaderProps {
  onCloseRegisterRequest: () => void;
}

const statusColors: Record<RegisterStatus, string> = {
  OPEN: 'bg-amber-100 text-amber-700 border-amber-200',
  COUNTED: 'bg-blue-100 text-blue-700 border-blue-200',
  CLOSED: 'bg-slate-100 text-slate-500 border-slate-200',
};

export const RegisterHeader: React.FC<RegisterHeaderProps> = ({ onCloseRegisterRequest }) => {
  const { currentRegister } = useRegisterStore();
  const navigate = useNavigate();

  if (!currentRegister) {
    return (
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Z-Report / End of Day Closing</h1>
          <p className="text-slate-500 text-sm mt-1">No active shift — open a shift to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Z-Report / End of Day Closing</h1>
        <p className="text-slate-500 text-sm mt-1">Accountant-ready closing summary for {currentRegister.date}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className={`px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-widest border ${statusColors[currentRegister.status]}`}>
          {currentRegister.status}
        </span>

        <button
          onClick={onCloseRegisterRequest}
          disabled={currentRegister.status === 'CLOSED'}
          className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 disabled:text-slate-500 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
        >
          <Lock className="w-4 h-4" />
          Close Register
        </button>

        <div className="w-px h-8 bg-slate-200 mx-1"></div>

        <button
          onClick={() => exportRegisterExcel(currentRegister)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          Excel
        </button>
        <button
          onClick={() => exportRegisterPDF(currentRegister)}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          <FileText className="w-4 h-4 text-rose-500" />
          PDF
        </button>
        <button
          onClick={() => navigate('/zreport')}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
        >
          <Printer className="w-4 h-4" />
          Print Z-Report
        </button>
      </div>
    </div>
  );
};
