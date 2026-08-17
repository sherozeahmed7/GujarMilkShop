import React from 'react';
import { Supplier } from '../../types';
import { useSupplierStore } from '../../store/supplierStore';
import { FileText, ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface CycleReportProps {
  supplier: Supplier;
}

export const CycleReport: React.FC<CycleReportProps> = ({ supplier }) => {
  const { collections, payments } = useSupplierStore();

  // Filter and sort ledger entries
  const supplierCollections = collections.filter(c => c.supplierId === supplier.id).map(c => ({
    id: c.id,
    date: c.date,
    type: 'Collection' as const,
    description: `${c.shift} Shift - ${c.milkType} Milk (${c.quantity}kg @ Rs.${c.rate})`,
    amount: c.amount,
  }));

  const supplierPayments = payments.filter(p => p.supplierId === supplier.id).map(p => ({
    id: p.id,
    date: p.date,
    type: 'Payment' as const,
    description: `Payment ${p.notes ? ` - ${p.notes}` : ''}`,
    amount: -p.amount, // Payments decrease payable balance
  }));

  const ledger = [...supplierCollections, ...supplierPayments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-bold text-slate-800">Cycle Ledger</h3>
        <button className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
          <FileText className="w-4 h-4" />
          Export Statement
        </button>
      </div>

      <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-white shadow-sm custom-scrollbar">
        {ledger.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No entries found for this cycle.
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Credit (+)</th>
                <th className="px-4 py-3 text-right">Debit (-)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((entry) => (
                <tr key={`${entry.type}-${entry.id}`} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-medium">
                    {new Date(entry.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3 text-slate-800">
                    <div className="flex items-center gap-2">
                      {entry.type === 'Collection' ? (
                        <ArrowUpRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      )}
                      {entry.description}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">
                    {entry.amount > 0 ? `Rs. ${entry.amount.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-600">
                    {entry.amount < 0 ? `Rs. ${Math.abs(entry.amount).toLocaleString()}` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
