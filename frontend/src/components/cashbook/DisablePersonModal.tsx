import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { CashPerson } from '../../types/cashbook';
import { disableCashPerson, enableCashPerson } from '../../services/cashbook.service';

interface Props {
  person: CashPerson;
  onClose: () => void;
  onSuccess: () => void;
}

export const DisablePersonModal: React.FC<Props> = ({ person, onClose, onSuccess }) => {
  const [isSaving, setIsSaving] = useState(false);
  const isDisabling = person.status === 'Active';

  const handleConfirm = async () => {
    setIsSaving(true);
    try {
      if (isDisabling) {
        await disableCashPerson(person.id);
      } else {
        await enableCashPerson(person.id);
      }
      onSuccess();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-2xl border border-slate-100 dark:border-[#2d4a35] max-w-sm w-full p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${isDisabling ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-[#e2f5e8]">
              {isDisabling ? 'Disable Cash Person' : 'Enable Cash Person'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#8ba895] mt-0.5">{person.name}</p>
          </div>
          <button onClick={onClose} className="ml-auto p-2 hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg text-slate-400 dark:text-[#64916e] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className={`rounded-xl p-4 mb-5 text-sm ${isDisabling ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'}`}>
          {isDisabling ? (
            <>
              <p className="font-semibold mb-1">Are you sure you want to disable <strong>{person.name}</strong>?</p>
              <ul className="space-y-1 text-xs mt-2 text-amber-700 list-disc list-inside">
                <li>All historical records will be preserved.</li>
                <li>All transactions and ledger entries remain intact.</li>
                <li>This person cannot be selected for new transactions.</li>
                <li>You can re-enable them at any time.</li>
              </ul>
            </>
          ) : (
            <>
              <p className="font-semibold mb-1">Re-enable <strong>{person.name}</strong>?</p>
              <p className="text-xs mt-1 text-emerald-700">This person will become available for new transactions again.</p>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-[#2d4a35]">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-[#a7c4ae] hover:bg-slate-100 dark:hover:bg-[#1e3124] rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSaving}
            className={`px-4 py-2 text-xs font-bold text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-sm ${
              isDisabling
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
            }`}
          >
            {isSaving ? (
              <><span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Working…</>
            ) : isDisabling ? 'Disable Person' : 'Enable Person'}
          </button>
        </div>
      </div>
    </div>
  );
};
