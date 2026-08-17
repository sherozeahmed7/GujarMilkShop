import React, { useState } from 'react';
import { ClipboardList, Search, X } from 'lucide-react';

interface ClosingReceiptCountProps {
  onRunAudit: (date: string, receiptsText: string, notes: string) => void;
}

export const ClosingReceiptCount: React.FC<ClosingReceiptCountProps> = ({ onRunAudit }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [scanInput, setScanInput] = useState('');
  const [receiptsText, setReceiptsText] = useState('');
  const [notes, setNotes] = useState('');

  const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      e.preventDefault();
      const val = scanInput.trim().toUpperCase();
      setReceiptsText((prev) => (prev ? `${prev}\n${val}` : val));
      setScanInput('');
    }
  };

  const receiptCount = receiptsText
    .split(/[\n, ]+/)
    .filter((r) => r.trim().length > 0).length;

  const handleClear = () => {
    setScanInput('');
    setReceiptsText('');
    setNotes('');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-slate-500" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Closing Receipt Count</h2>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 flex flex-col gap-5">
        <p className="text-sm text-slate-500">
          Type or paste bill numbers from the physical receipt pile.
        </p>

        {/* Scan Input */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
            Scan Receipt Barcode
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleScanKeyDown}
              placeholder="Focus here, scan receipt, press Enter"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-700 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400 transition"
            />
          </div>
        </div>

        {/* Textarea */}
        <div className="flex-1 flex flex-col min-h-[150px]">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Collected Receipt Numbers
            </label>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              Count: {receiptCount}
            </span>
          </div>
          <textarea
            value={receiptsText}
            onChange={(e) => setReceiptsText(e.target.value)}
            placeholder={`Example:\nBILL-0001\nBILL-0002\nBILL-0003`}
            className="flex-1 w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 font-mono bg-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400 transition"
          />
          <p className="text-xs text-slate-400 mt-2">
            Separate by new line, comma, or space.
          </p>
        </div>

        {/* Notes */}
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
            Audit Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Example: One receipt missing, checked with delivery staff..."
            rows={2}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-slate-400 transition"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3 flex-shrink-0 pt-2 border-t border-slate-100 mt-auto">
          <button
            onClick={() => onRunAudit(date, receiptsText, notes)}
            disabled={receiptCount === 0}
            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 active:scale-95 text-white text-sm font-bold rounded-xl shadow-sm transition-all"
          >
            Run Audit
          </button>
          <button
            onClick={handleClear}
            className="px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold rounded-xl transition-all"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
};
