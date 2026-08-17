import React, { useState } from 'react';
import { Customer } from '../../types';
import { useCustomerStore } from '../../store/customerStore';
import { X, BookOpen, Plus, Printer } from 'lucide-react';
import { AddCreditModal } from '../customers/AddCreditModal';

interface KhataLedgerModalProps {
  customer: Customer;
  onClose: () => void;
}

export const KhataLedgerModal: React.FC<KhataLedgerModalProps> = ({ customer, onClose }) => {
  const { transactions } = useCustomerStore();
  const [isAddCreditOpen, setIsAddCreditOpen] = useState(false);

  const customerTxs = transactions
    .filter(t => t.customerId === customer.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningBalance = 0;
  const ledger = customerTxs.map(tx => {
    if (tx.type === 'Payment') runningBalance -= tx.amount;
    else runningBalance += tx.amount;
    return { ...tx, runningBalance };
  }).reverse();

  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Khata Statement - ${customer.name}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; font-size: 13px; }
            h2 { margin-bottom: 4px; }
            p { color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; }
            td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
            .debit { color: #dc2626; font-weight: 600; }
            .credit { color: #16a34a; font-weight: 600; }
            .footer { margin-top: 20px; padding-top: 12px; border-top: 2px solid #1e293b; display: flex; justify-content: flex-end; }
            .balance { font-size: 18px; font-weight: bold; color: #dc2626; }
          </style>
        </head>
        <body>
          <h2>Khata Statement — ${customer.name}</h2>
          <p>Card #${customer.cardNumber} | ${customer.phone || 'No Phone'} | Printed: ${new Date().toLocaleString()}</p>
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Debit (+)</th><th>Credit (-)</th><th>Balance</th></tr></thead>
            <tbody>
              ${ledger.map(tx => `<tr>
                <td>${tx.date}</td>
                <td>${tx.type}${tx.description !== tx.type ? ` — ${tx.description}` : ''}</td>
                <td class="debit">${tx.type !== 'Payment' ? 'Rs. ' + tx.amount.toLocaleString() : '-'}</td>
                <td class="credit">${tx.type === 'Payment' ? 'Rs. ' + tx.amount.toLocaleString() : '-'}</td>
                <td>Rs. ${tx.runningBalance.toLocaleString()}</td>
              </tr>`).join('')}
            </tbody>
          </table>
          <div class="footer"><span class="balance">Outstanding: Rs. ${customer.balance.toLocaleString()}</span></div>
        </body>
      </html>
    `;
    const win = window.open('', '_blank');
    if (win) { win.document.write(printContent); win.document.close(); win.print(); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{customer.name}</h3>
              <p className="text-xs text-slate-500">Card #{customer.cardNumber} • {customer.phone || 'No phone'} • Khata Ledger</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-end mr-3">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outstanding</span>
              <span className={`text-xl font-bold ${customer.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {customer.balance > 0 ? `Rs. ${customer.balance.toLocaleString()}` : 'Cleared'}
              </span>
            </div>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-b border-slate-100 flex justify-end flex-shrink-0">
          <button
            onClick={() => setIsAddCreditOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Credit Sale
          </button>
        </div>

        {/* Ledger Table */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 bg-slate-50">
          {ledger.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3">
              <BookOpen className="w-12 h-12 text-slate-300" />
              <p className="text-sm font-medium">No transactions yet for this customer.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3 text-right">Debit (+)</th>
                    <th className="px-4 py-3 text-right">Credit (-)</th>
                    <th className="px-4 py-3 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledger.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 font-medium whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold ${
                          tx.type === 'Payment' ? 'bg-emerald-50 text-emerald-700' :
                          tx.type === 'Opening Balance' ? 'bg-blue-50 text-blue-700' :
                          'bg-rose-50 text-rose-700'
                        }`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {tx.description}
                        {tx.method && <span className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{tx.method}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-rose-600">
                        {tx.type !== 'Payment' ? `Rs. ${tx.amount.toLocaleString()}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                        {tx.type === 'Payment' ? `Rs. ${tx.amount.toLocaleString()}` : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-700">
                        Rs. {tx.runningBalance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-right font-bold text-slate-600 text-sm">Final Outstanding Balance</td>
                    <td className={`px-4 py-3 text-right font-bold text-base ${customer.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      Rs. {customer.balance.toLocaleString()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {isAddCreditOpen && (
        <AddCreditModal customer={customer} onClose={() => setIsAddCreditOpen(false)} />
      )}
    </div>
  );
};
