import { create } from 'zustand';
import { Supplier, MilkCollection, SupplierPayment } from '../types';
import { supplierService } from '../services/supplier.service';

interface SupplierStore {
  suppliers: Supplier[];
  collections: MilkCollection[];
  payments: SupplierPayment[];
  isLoading: boolean;
  error: string | null;
  fetchData: () => Promise<void>;
  addSupplier: (supplier: Omit<Supplier, 'id' | 'payableBalance' | 'code'> & { code?: string; openingBalance?: number }) => Promise<void>;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
  addCollection: (collection: Omit<MilkCollection, 'id'>) => Promise<void>;
  updateCollection: (id: string, collection: Partial<MilkCollection>) => Promise<void>;
  deleteCollection: (id: string) => Promise<void>;
  addPayment: (payment: Omit<SupplierPayment, 'id'>) => Promise<void>;
}

export const useSupplierStore = create<SupplierStore>((set, get) => ({
  suppliers: [], collections: [], payments: [], isLoading: false, error: null,
  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const suppliers = await supplierService.list();
      const entries = await Promise.all(suppliers.map((supplier) => supplierService.entries(supplier.id)));
      set({ suppliers, collections: entries.flatMap((entry) => entry.collections), payments: entries.flatMap((entry) => entry.payments), isLoading: false });
    } catch (error: any) { set({ error: error.message || 'Failed to load suppliers.', isLoading: false }); }
  },
  addSupplier: async (data) => { try { await supplierService.create(data); await get().fetchData(); } catch (error: any) { set({ error: error.message }); throw error; } },
  updateSupplier: async (id, data) => { try { await supplierService.update(id, data); await get().fetchData(); } catch (error: any) { set({ error: error.message }); throw error; } },
  addCollection: async (data) => { try { await supplierService.saveCollection(data.supplierId, data); await get().fetchData(); } catch (error: any) { set({ error: error.message }); throw error; } },
  updateCollection: async (id, data) => {
    try {
      const current = get().collections.find((collection) => collection.id === id);
      if (!current) throw new Error('Collection not found.');
      await supplierService.saveCollection(current.supplierId, { ...current, ...data, id });
      await get().fetchData();
    } catch (error: any) { set({ error: error.message }); throw error; }
  },
  deleteCollection: async (id) => { try { await supplierService.deleteCollection(id); await get().fetchData(); } catch (error: any) { set({ error: error.message }); throw error; } },
  addPayment: async (data) => { try { await supplierService.addPayment(data.supplierId, data); await get().fetchData(); } catch (error: any) { set({ error: error.message }); throw error; } },
}));
