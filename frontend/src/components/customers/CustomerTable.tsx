import React, { useState } from 'react';
import { Customer } from '../../types';
import { Edit2, BookOpen, DollarSign, Trash2 } from 'lucide-react';
import { useCustomerStore } from '../../store/customerStore';

interface CustomerTableProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onCollect: (customer: Customer) => void;
  onViewKhata: (customer: Customer) => void;
}

export const CustomerTable: React.FC<CustomerTableProps> = ({ customers, onEdit, onCollect, onViewKhata }) => {
  return (
    <table className="w-full text-left border-collapse">
      <thead className="bg-slate-50 sticky top-0 z-10">
        <tr>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">Customer</th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">Phone</th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100 text-center">Card</th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">Balance</th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100">Last Sale</th>
          <th className="px-5 py-4 font-semibold text-xs text-slate-500 uppercase tracking-wider border-b border-slate-100 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {customers.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
              No customers found. Try adjusting your search or filters.
            </td>
          </tr>
        ) : (
          customers.map(customer => (
            <CustomerRow 
              key={customer.id} 
              customer={customer} 
              onEdit={() => onEdit(customer)}
              onCollect={() => onCollect(customer)}
              onViewKhata={() => onViewKhata(customer)}
            />
          ))
        )}
      </tbody>
    </table>
  );
};

interface CustomerRowProps {
  customer: Customer;
  onEdit: () => void;
  onCollect: () => void;
  onViewKhata: () => void;
}

const CustomerRow: React.FC<CustomerRowProps> = ({ customer, onEdit, onCollect, onViewKhata }) => {
  const { deleteCustomer } = useCustomerStore();
  
  const initials = customer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete ${customer.name}?`)) {
      deleteCustomer(customer.id);
    }
  };

  const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString()}`;

  return (
    <tr className="hover:bg-slate-50/70 transition-colors group">
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0">
            {initials}
          </div>
          <div>
            <div className="font-semibold text-sm text-slate-800">{customer.name}</div>
            {customer.address && <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[150px]">{customer.address}</div>}
          </div>
        </div>
      </td>
      <td className="px-5 py-3 text-sm text-slate-600 font-medium">
        {customer.phone || '-'}
      </td>
      <td className="px-5 py-3 text-center">
        {customer.cardNumber ? (
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-slate-200 bg-white text-xs font-bold text-slate-700">
            {customer.cardNumber}
          </span>
        ) : '-'}
      </td>
      <td className="px-5 py-3">
        {customer.balance > 0 ? (
          <span className="font-bold text-sm text-rose-600">{formatCurrency(customer.balance)}</span>
        ) : (
          <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs bg-emerald-50 px-2 py-1 rounded-md">
            Clear
          </span>
        )}
      </td>
      <td className="px-5 py-3 text-sm text-slate-500">
        {customer.lastSaleDate ? new Date(customer.lastSaleDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : 'Never'}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-1 opacity-100 lg:opacity-60 lg:group-hover:opacity-100 transition-opacity">
          
          <button 
            onClick={onCollect}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              customer.balance > 0 
                ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50' 
                : 'text-slate-400 bg-slate-50 cursor-not-allowed border border-slate-100'
            }`}
            disabled={customer.balance <= 0}
          >
            <DollarSign className="w-3.5 h-3.5" />
            Collect
          </button>

          <button 
            onClick={onViewKhata}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            Khata
          </button>

          <button 
            onClick={onEdit}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors ml-1"
            title="Edit"
          >
            <Edit2 className="w-4 h-4" />
          </button>

          <button 
            onClick={handleDelete}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          
        </div>
      </td>
    </tr>
  );
};
