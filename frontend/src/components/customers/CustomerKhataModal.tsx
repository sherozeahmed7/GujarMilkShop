import React, { useState } from 'react';
import { Customer } from '../../types';
import { X, BookOpen, Plus } from 'lucide-react';
import { AddCreditModal } from './AddCreditModal';

interface CustomerKhataModalProps {
  customer: Customer;
  onClose: () => void;
}

export const CustomerKhataModal: React.FC<CustomerKhataModalProps> = ({ customer, onClose }) => {
  const [isAddCreditOpen, setIsAddCreditOpen] = useState(false);

  // Transactions now come from real sales via Customers page.
  // This modal is kept for UI compatibility — shows empty ledger.
  const ledgerWithBalance: any[] = [];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#1a2e1f] rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#2d4a35] bg-slate-50 dark:bg-[#142119]/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 dark:text-[#a7c4ae]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-[#e2f5e8]">Khata Statement</h3>
              <p className="text-xs font-medium text-slate-500 dark:text-[#8ba895]">Ledger for {customer.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-4">
              <span className="text-[10px] font-bold text-slate-500 dark:text-[#8ba895] uppercase tracking-wider">Current Balance</span>
              <span className={`text-xl font-bold ${customer.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {customer.balance > 0 ? `Rs. ${customer.balance.toLocaleString()}` : 'Clear'}
              </span>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 dark:text-[#64916e] hover:text-slate-600 dark:hover:text-[#a7c4ae] hover:bg-slate-200 dark:hover:bg-[#1e3124] rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100 dark:border-[#2d4a35] flex items-center justify-between flex-shrink-0">
          <div className="flex gap-2">
             <button className="px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold shadow-sm">
               All Transactions
             </button>
          </div>
          <button 
            onClick={() => setIsAddCreditOpen(true)}
            className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-xl text-sm font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Credit Sale
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-slate-50 dark:bg-[#142119]">
          {ledgerWithBalance.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-[#64916e]">
              <BookOpen className="w-12 h-12 mb-3 text-slate-300" />
              <p className="text-sm font-medium">No transactions found for this customer.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#142119] border border-slate-200 dark:border-[#2d4a35] rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-[#142119] border-b border-slate-200 dark:border-[#2d4a35] text-slate-600 dark:text-[#a7c4ae] font-semibold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Debit (+)</th>
                    <th className="px-4 py-3 text-right">Credit (-)</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35]">
                  {ledgerWithBalance.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600 dark:text-[#a7c4ae] font-medium">
                        {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-slate-800 dark:text-[#e2f5e8]">
                        <div className="flex flex-col">
                          <span className="font-semibold">{tx.type}</span>
                          <span className="text-xs text-slate-500 dark:text-[#8ba895]">{tx.description}</span>
                          {tx.method && <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-fit mt-1">{tx.method}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-rose-600">
                        {tx.type !== 'Payment' ? `Rs. ${tx.amount.toLocaleString()}` : 'Not Available'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">
                        {tx.type === 'Payment' ? `Rs. ${tx.amount.toLocaleString()}` : 'Not Available'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700 dark:text-[#a7c4ae]">
                        Rs. {tx.runningBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {isAddCreditOpen && (
        <AddCreditModal 
          customer={customer} 
          onClose={() => setIsAddCreditOpen(false)} 
        />
      )}
    </div>
  );
};
