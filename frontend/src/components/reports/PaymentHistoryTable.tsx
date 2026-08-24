import React from 'react';
import { CustomerPayment } from '../../types/customerMilkReport';
import { Receipt } from 'lucide-react';

interface PaymentHistoryTableProps {
  payments: CustomerPayment[];
}

const fmtRs = (n: number) => `Rs. ${Math.round(n).toLocaleString()}`;

export const PaymentHistoryTable: React.FC<PaymentHistoryTableProps> = ({ payments }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
      <Receipt className="w-4 h-4 text-slate-500" />
      <h3 className="font-bold text-slate-800 text-sm">Payment History</h3>
      <span className="ml-auto text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full">
        {payments.length} record{payments.length !== 1 ? 's' : ''}
      </span>
    </div>

    {payments.length === 0 ? (
      <div className="px-5 py-8 text-center text-slate-400 text-sm">
        No payments recorded for this month.
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-100">
            <tr>
              <th className="px-5 py-3">Date</th>
              <th className="px-5 py-3">Amount</th>
              <th className="px-5 py-3">Method</th>
              <th className="px-5 py-3">Notes</th>
              <th className="px-5 py-3">Received By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3 text-slate-700 whitespace-nowrap">
                  {new Date(p.date).toLocaleDateString('en-PK', {
                    day: '2-digit', month: 'short', year: 'numeric',
                  })}
                </td>
                <td className="px-5 py-3 font-semibold text-emerald-600 whitespace-nowrap">
                  {fmtRs(p.amount)}
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                    {p.method}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500">{p.notes || '—'}</td>
                <td className="px-5 py-3 text-slate-500">{p.receivedBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
