import { create } from 'zustand';
import { Customer, KhataTransaction } from '../types';

interface CustomerStore {
  customers: Customer[];
  transactions: KhataTransaction[];
  addCustomer: (customer: Omit<Customer, 'id'>) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addTransaction: (transaction: Omit<KhataTransaction, 'id'>) => void;
  collectPayment: (customerId: string, amount: number, method: string, notes?: string) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// Helper to generate some transactions for initial mock data
const generateMockTransactions = (customerId: string, balance: number): KhataTransaction[] => {
  const txs: KhataTransaction[] = [];
  if (balance > 0) {
    txs.push({
      id: generateId(),
      customerId,
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'Opening Balance',
      amount: balance + 500, // Initial was higher
      description: 'Opening Balance',
    });
    txs.push({
      id: generateId(),
      customerId,
      date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'Payment',
      amount: 500, // They paid 500
      description: 'Payment',
      method: 'Cash'
    });
  } else {
    txs.push({
      id: generateId(),
      customerId,
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: 'Opening Balance',
      amount: 0,
      description: 'Opening Balance',
    });
  }
  return txs;
};

const initialCustomers: Customer[] = [
  { id: 'cust-1', name: 'Mama Gari', phone: '0300-1234567', cardNumber: '80', address: 'Main Bazar', notes: '', balance: 0, lastSaleDate: null },
  { id: 'cust-2', name: 'Abdul Malik', phone: '0301-9876543', cardNumber: '29', address: 'Street 5', notes: '', balance: 12190, lastSaleDate: '2026-08-10' },
  { id: 'cust-3', name: 'Abdul Samad', phone: '0333-1122334', cardNumber: '55', address: 'Near Mosque', notes: '', balance: 7320, lastSaleDate: '2026-08-12' },
  { id: 'cust-4', name: 'Abdullah', phone: '0345-5566778', cardNumber: '102', address: 'Block C', notes: '', balance: 12035, lastSaleDate: '2026-08-14' },
  { id: 'cust-5', name: 'Afnan', phone: '0312-9988776', cardNumber: '90', address: 'Phase 1', notes: '', balance: 18320, lastSaleDate: '2026-08-11' },
  { id: 'cust-6', name: 'Aftab Bhai', phone: '0300-1112223', cardNumber: '108', address: 'Shop 42', notes: '', balance: 4500, lastSaleDate: '2026-08-05' },
  { id: 'cust-7', name: 'Ahmed', phone: '0321-4455667', cardNumber: '15', address: 'Gulberg', notes: '', balance: 0, lastSaleDate: '2026-07-20' },
  { id: 'cust-8', name: 'Ali Raza', phone: '0333-9998887', cardNumber: '42', address: 'DHA', notes: '', balance: 5400, lastSaleDate: '2026-08-13' },
  { id: 'cust-9', name: 'Bilal Khan', phone: '0344-1231234', cardNumber: '67', address: 'Cantt', notes: '', balance: 21500, lastSaleDate: '2026-08-15' },
  { id: 'cust-10', name: 'Chaudhry Akram', phone: '0300-5556667', cardNumber: '03', address: 'Model Town', notes: '', balance: 0, lastSaleDate: null },
  { id: 'cust-11', name: 'Danish', phone: '0311-2233445', cardNumber: '88', address: 'Johar Town', notes: '', balance: 8900, lastSaleDate: '2026-08-01' },
  { id: 'cust-12', name: 'Ehsan', phone: '0302-3344556', cardNumber: '112', address: 'Wapda Town', notes: '', balance: 1250, lastSaleDate: '2026-08-08' },
  { id: 'cust-13', name: 'Faisal', phone: '0331-7788990', cardNumber: '34', address: 'Saddar', notes: '', balance: 34000, lastSaleDate: '2026-08-15' },
  { id: 'cust-14', name: 'Ghulam Rasool', phone: '0345-0001112', cardNumber: '76', address: 'Township', notes: '', balance: 0, lastSaleDate: '2026-08-02' },
  { id: 'cust-15', name: 'Hassan', phone: '0322-8889990', cardNumber: '91', address: 'Iqbal Town', notes: '', balance: 6700, lastSaleDate: '2026-08-14' },
];

const initialTransactions = initialCustomers.flatMap(c => generateMockTransactions(c.id, c.balance));

export const useCustomerStore = create<CustomerStore>((set) => ({
  customers: initialCustomers,
  transactions: initialTransactions,

  addCustomer: (customerData) => set((state) => {
    const newCustomer: Customer = {
      ...customerData,
      id: generateId(),
    };
    
    // Create an opening balance transaction
    const newTx: KhataTransaction = {
      id: generateId(),
      customerId: newCustomer.id,
      date: new Date().toISOString().split('T')[0],
      type: 'Opening Balance',
      amount: newCustomer.balance,
      description: 'Opening Balance',
    };

    return { 
      customers: [...state.customers, newCustomer],
      transactions: [...state.transactions, newTx]
    };
  }),

  updateCustomer: (id, customerData) => set((state) => ({
    customers: state.customers.map((c) =>
      c.id === id ? { ...c, ...customerData } : c
    ),
  })),

  deleteCustomer: (id) => set((state) => ({
    customers: state.customers.filter((c) => c.id !== id),
    transactions: state.transactions.filter((t) => t.customerId !== id)
  })),

  addTransaction: (txData) => set((state) => {
    const newTx: KhataTransaction = {
      ...txData,
      id: generateId(),
    };

    const updatedCustomers = state.customers.map((c) => {
      if (c.id === txData.customerId) {
        let newBalance = c.balance;
        if (txData.type === 'Credit Sale') newBalance += txData.amount;
        else if (txData.type === 'Payment') newBalance -= txData.amount;
        
        return { ...c, balance: newBalance };
      }
      return c;
    });

    return {
      transactions: [newTx, ...state.transactions], // Prepend to show latest first ideally, though we usually sort later
      customers: updatedCustomers
    };
  }),

  collectPayment: (customerId, amount, method, notes) => set((state) => {
    const newTx: KhataTransaction = {
      id: generateId(),
      customerId,
      date: new Date().toISOString().split('T')[0],
      type: 'Payment',
      amount,
      method,
      description: notes || 'Payment Received',
    };

    const updatedCustomers = state.customers.map((c) => {
      if (c.id === customerId) {
        return { ...c, balance: Math.max(0, c.balance - amount) };
      }
      return c;
    });

    return {
      transactions: [...state.transactions, newTx],
      customers: updatedCustomers
    };
  })
}));
