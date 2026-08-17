import { create } from 'zustand';
import { Supplier, MilkCollection, SupplierPayment } from '../types';

interface SupplierStore {
  suppliers: Supplier[];
  collections: MilkCollection[];
  payments: SupplierPayment[];
  addSupplier: (supplier: Omit<Supplier, 'id' | 'payableBalance'>) => void;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => void;
  addCollection: (collection: Omit<MilkCollection, 'id'>) => void;
  updateCollection: (id: string, collection: Partial<MilkCollection>) => void;
  deleteCollection: (id: string) => void;
  addPayment: (payment: Omit<SupplierPayment, 'id'>) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const useSupplierStore = create<SupplierStore>((set) => ({
  suppliers: [
    {
      id: 'sup-1',
      name: 'Abid',
      code: 'SUP-0040',
      phone: '',
      defaultRate: 180,
      cowRate: 180,
      buffaloRate: 180,
      cycleType: 'Monthly Cycle',
      isActive: true,
      guaranteedAdvance: 0,
      payableBalance: 14400,
    },
    {
      id: 'sup-2',
      name: 'Ahmed Iqbal',
      code: 'SUP-0050',
      phone: '',
      defaultRate: 180,
      cowRate: 180,
      buffaloRate: 180,
      cycleType: 'Monthly Cycle',
      isActive: true,
      guaranteedAdvance: 0,
      payableBalance: 1205800,
    },
    {
      id: 'sup-3',
      name: 'Ali darwesh',
      code: 'SUP-0039',
      phone: '',
      defaultRate: 180,
      cowRate: 180,
      buffaloRate: 180,
      cycleType: 'Monthly Cycle',
      isActive: true,
      guaranteedAdvance: 0,
      payableBalance: 65835,
    },
    {
      id: 'sup-4',
      name: 'Dani',
      code: 'SUP-0049',
      phone: '',
      defaultRate: 180,
      cowRate: 180,
      buffaloRate: 180,
      cycleType: '1-Day Cycle',
      isActive: true,
      guaranteedAdvance: 0,
      payableBalance: 5191.5,
    }
  ],
  collections: [],
  payments: [],
  
  addSupplier: (supplierData) => set((state) => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: generateId(),
      payableBalance: 0,
    };
    return { suppliers: [...state.suppliers, newSupplier] };
  }),
  
  updateSupplier: (id, supplierData) => set((state) => ({
    suppliers: state.suppliers.map((sup) =>
      sup.id === id ? { ...sup, ...supplierData } : sup
    ),
  })),
  
  addCollection: (collectionData) => set((state) => {
    const newCollection: MilkCollection = {
      ...collectionData,
      id: generateId(),
    };
    
    // Update supplier payable balance
    const updatedSuppliers = state.suppliers.map(sup => 
      sup.id === collectionData.supplierId 
        ? { ...sup, payableBalance: sup.payableBalance + collectionData.amount }
        : sup
    );
    
    return { 
      collections: [...state.collections, newCollection],
      suppliers: updatedSuppliers
    };
  }),
  
  updateCollection: (id, collectionData) => set((state) => {
    const oldCollection = state.collections.find(c => c.id === id);
    if (!oldCollection) return state;

    const newAmount = collectionData.amount !== undefined ? collectionData.amount : oldCollection.amount;
    const amountDifference = newAmount - oldCollection.amount;

    const updatedSuppliers = state.suppliers.map(sup => 
      sup.id === oldCollection.supplierId 
        ? { ...sup, payableBalance: sup.payableBalance + amountDifference }
        : sup
    );

    return {
      collections: state.collections.map(c => 
        c.id === id ? { ...c, ...collectionData } : c
      ),
      suppliers: updatedSuppliers
    };
  }),

  deleteCollection: (id) => set((state) => {
    const collection = state.collections.find(c => c.id === id);
    if (!collection) return state;

    const updatedSuppliers = state.suppliers.map(sup => 
      sup.id === collection.supplierId 
        ? { ...sup, payableBalance: sup.payableBalance - collection.amount }
        : sup
    );

    return {
      collections: state.collections.filter(c => c.id !== id),
      suppliers: updatedSuppliers
    };
  }),
  
  addPayment: (paymentData) => set((state) => {
    const newPayment: SupplierPayment = {
      ...paymentData,
      id: generateId(),
    };

    // Update supplier payable balance
    const updatedSuppliers = state.suppliers.map(sup => 
      sup.id === paymentData.supplierId 
        ? { ...sup, payableBalance: sup.payableBalance - paymentData.amount }
        : sup
    );

    return {
      payments: [...state.payments, newPayment],
      suppliers: updatedSuppliers
    };
  }),
}));
