import React, { useState, useEffect } from 'react';
import { MilkProductTransaction } from '../../types/milkProducts.types';
import { milkProductsService } from '../../services/milkProducts.service';

export const ProductHistory: React.FC<{ date: string }> = ({ date }) => {
  const [txs, setTxs] = useState<MilkProductTransaction[]>([]);
  
  useEffect(() => {
    milkProductsService.getTransactions(date).then(setTxs);
  }, [date]);

  if (txs.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1a2e1f] rounded-xl border border-slate-200 dark:border-[#2d4a35] p-8 text-center shadow-sm mt-6">
        <p className="text-slate-500 dark:text-[#8ba895] text-sm">No transactions recorded for this date.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#1a2e1f] rounded-xl border border-slate-200 dark:border-[#2d4a35] shadow-sm overflow-hidden mt-6">
      <div className="px-6 py-4 border-b border-slate-100 dark:border-[#2d4a35] flex justify-between items-center">
        <h2 className="font-bold text-slate-800 dark:text-[#e2f5e8]">Transaction History</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-slate-50 dark:bg-[#142119] text-slate-500 dark:text-[#8ba895] font-bold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="px-6 py-3">Time</th>
              <th className="px-6 py-3">Product</th>
              <th className="px-6 py-3">Action</th>
              <th className="px-6 py-3">Quantity</th>
              <th className="px-6 py-3">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-[#2d4a35] text-slate-700 dark:text-[#a7c4ae]">
            {txs.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-[#1e3124]">
                <td className="px-6 py-3 font-medium text-slate-500 dark:text-[#8ba895]">
                  {new Date(t.createdAt).toLocaleTimeString()}
                </td>
                <td className="px-6 py-3 font-bold text-slate-800 dark:text-[#e2f5e8]">{t.product}</td>
                <td className="px-6 py-3">{t.type.replace('_', ' ').toUpperCase()}</td>
                <td className="px-6 py-3 font-bold text-slate-800 dark:text-[#e2f5e8]">{t.quantity} kg</td>
                <td className="px-6 py-3 text-slate-500 dark:text-[#8ba895] text-xs truncate max-w-[200px]">{t.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
