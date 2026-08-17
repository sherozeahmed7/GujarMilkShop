import React from 'react';
import { Users, AlertTriangle, DollarSign } from 'lucide-react';
import { useCustomerStore } from '../../store/customerStore';

export const CustomerSummary: React.FC = () => {
  const { customers } = useCustomerStore();

  const totalCustomers = customers.length;
  const totalOutstanding = customers.reduce((sum, c) => sum + c.balance, 0);
  const withDues = customers.filter(c => c.balance > 0).length;

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Total Customers */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 flex-shrink-0">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Customers</p>
          <h3 className="text-2xl font-bold text-slate-800">{totalCustomers}</h3>
        </div>
      </div>

      {/* Total Outstanding */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0">
          <DollarSign className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Outstanding</p>
          <h3 className="text-2xl font-bold text-rose-600">{formatCurrency(totalOutstanding)}</h3>
        </div>
      </div>

      {/* With Dues */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">With Dues</p>
          <h3 className="text-2xl font-bold text-amber-600">{withDues}</h3>
        </div>
      </div>

    </div>
  );
};
