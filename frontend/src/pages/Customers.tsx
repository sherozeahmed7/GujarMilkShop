import React, { useState } from 'react';
import { CustomerSummary } from '../components/customers/CustomerSummary';
import { CustomerToolbar } from '../components/customers/CustomerToolbar';
import { CustomerTable } from '../components/customers/CustomerTable';
import { CustomerFormModal } from '../components/customers/CustomerFormModal';
import { CollectPaymentModal } from '../components/customers/CollectPaymentModal';
import { CustomerKhataModal } from '../components/customers/CustomerKhataModal';
import { useCustomerStore } from '../store/customerStore';
import { Plus } from 'lucide-react';
import { Customer } from '../types';

export const Customers: React.FC = () => {
  const { customers } = useCustomerStore();
  
  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
  
  const [paymentCustomer, setPaymentCustomer] = useState<Customer | null>(null);
  const [khataCustomer, setKhataCustomer] = useState<Customer | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'All' | 'Dues'>('All');

  // Derived state
  const filteredCustomers = customers.filter(c => {
    // Dues filter
    if (filterType === 'Dues' && c.balance <= 0) return false;
    
    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        c.cardNumber.toLowerCase().includes(q)
      );
    }
    
    return true;
  });

  const handleAddClick = () => {
    setEditingCustomer(undefined);
    setIsFormModalOpen(true);
  };

  const handleEditClick = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsFormModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full gap-6">
      
      {/* Header */}
      <div className="flex items-start justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Customers & Khata</h1>
          <p className="text-slate-500 text-sm mt-1">Manage customer ledgers, due balances, and khata statements.</p>
        </div>
        <button 
          onClick={handleAddClick}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-sm transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Customer
        </button>
      </div>

      {/* Summary Cards */}
      <div className="flex-shrink-0">
        <CustomerSummary />
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col flex-1 min-h-0 overflow-hidden">
        <CustomerToolbar 
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterType={filterType}
          setFilterType={setFilterType}
          duesCount={customers.filter(c => c.balance > 0).length}
        />
        
        <div className="flex-1 overflow-auto custom-scrollbar">
          <CustomerTable 
            customers={filteredCustomers}
            onEdit={handleEditClick}
            onCollect={(c) => setPaymentCustomer(c)}
            onViewKhata={(c) => setKhataCustomer(c)}
          />
        </div>
      </div>

      {/* Modals */}
      {isFormModalOpen && (
        <CustomerFormModal 
          customer={editingCustomer}
          onClose={() => setIsFormModalOpen(false)} 
        />
      )}

      {paymentCustomer && (
        <CollectPaymentModal 
          customer={paymentCustomer}
          onClose={() => setPaymentCustomer(null)}
        />
      )}

      {khataCustomer && (
        <CustomerKhataModal 
          customer={khataCustomer}
          onClose={() => setKhataCustomer(null)}
        />
      )}

    </div>
  );
};
