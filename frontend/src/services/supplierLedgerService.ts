import { apiClient } from './apiClient';

export interface PurchaseEntry {
  id: string;
  supplierId: string;
  date: string;
  product: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  time: string;
}

export interface SupplierPaymentEntry {
  id: string;
  supplierId: string;
  date: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  addedBy: string;
}

export interface SupplierLedgerSummary {
  currentMonthAmount: number;
  previousBalance: number;
  totalPayable: number;
  totalPaid: number;
  remaining: number;
}

export interface SupplierInfo {
  id: string;
  name: string;
  phone: string;
  cycleType: string;
  payableBalance: number;
}

const monthRange = (month: number, year: number) => ({
  start: `${year}-${String(month).padStart(2, '0')}-01`,
  end: `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`,
});

const inMonth = (date: string, month: number, year: number) => {
  const range = monthRange(month, year);
  return date >= range.start && date <= range.end;
};

const mockSupplierEntries = (supplierId: string, month: number, year: number): PurchaseEntry[] => [
  { id: `mock-purchase-${supplierId}-${year}-${month}-01`, supplierId, date: `${year}-${String(month).padStart(2, '0')}-01`, product: 'Milk', quantity: 100, unit: 'kg', rate: 190, amount: 19000, time: '06:30' },
  { id: `mock-purchase-${supplierId}-${year}-${month}-15`, supplierId, date: `${year}-${String(month).padStart(2, '0')}-15`, product: 'Milk', quantity: 110, unit: 'kg', rate: 195, amount: 21450, time: '06:15' },
];
const mockSupplierPayments = (supplierId: string, month: number, year: number): SupplierPaymentEntry[] => [
  { id: `mock-supplier-payment-${supplierId}-${year}-${month}`, supplierId, date: `${year}-${String(month).padStart(2, '0')}-20`, amount: 10000, paymentMethod: 'cash', reference: 'MOCK-SUP-PAY-001', addedBy: 'System Admin' },
];
const mockSupplier = (supplierId: string): SupplierInfo => ({ id: supplierId, name: 'Dairy Farm Supplier (Demo)', phone: '0300-1234567', cycleType: 'Monthly Cycle', payableBalance: 30450 });

async function getEntries(supplierId: string) {
  const response = await apiClient.get(`/suppliers/${supplierId}/entries`);
  return {
    collections: (response.data?.collections || []) as any[],
    payments: (response.data?.payments || []) as any[],
  };
}

export const supplierLedgerService = {
  async getSupplier(supplierId: string): Promise<SupplierInfo> {
    try {
      const response = await apiClient.get(`/suppliers/${supplierId}`);
      const supplier = response.data;
      return { id: String(supplier.id), name: supplier.name, phone: supplier.phone || '', cycleType: supplier.cycleType, payableBalance: Number(supplier.payableBalance || 0) };
    } catch { return mockSupplier(supplierId); }
  },

  async getMonthlyPurchaseEntries(supplierId: string, month: number, year: number): Promise<PurchaseEntry[]> {
    try {
      const { collections } = await getEntries(supplierId);
      return collections.filter((entry) => inMonth(entry.date, month, year)).map((entry) => ({
      id: String(entry.id), supplierId: String(entry.supplierId), date: entry.date, product: `${entry.milkType} Milk`, quantity: Number(entry.quantity), unit: 'kg', rate: Number(entry.rate), amount: Number(entry.amount), time: entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
      }));
    } catch { return mockSupplierEntries(supplierId, month, year); }
  },

  async getMonthlyPayments(supplierId: string, month: number, year: number): Promise<SupplierPaymentEntry[]> {
    try {
      const { payments } = await getEntries(supplierId);
      return payments.filter((entry) => inMonth(entry.date, month, year)).map((entry) => ({
      id: String(entry.id), supplierId: String(entry.supplierId), date: entry.date, amount: Number(entry.amount), paymentMethod: entry.method || 'cash', reference: `PAY-${entry.id}`, addedBy: entry.createdBy?.name || 'System',
      }));
    } catch { return mockSupplierPayments(supplierId, month, year); }
  },

  async getPreviousBalance(supplierId: string, month: number, year: number): Promise<number> {
    try {
      const { collections, payments } = await getEntries(supplierId);
      const priorCollections = collections.filter((entry) => entry.date < monthRange(month, year).start).reduce((sum, entry) => sum + Number(entry.amount), 0);
      const priorPayments = payments.filter((entry) => entry.date < monthRange(month, year).start).reduce((sum, entry) => sum + Number(entry.amount), 0);
      return Math.round((priorCollections - priorPayments) * 100) / 100;
    } catch { return 25000; }
  },

  async getMonthlySummary(supplierId: string, month: number, year: number): Promise<SupplierLedgerSummary> {
    const [entries, payments, previousBalance] = await Promise.all([
      this.getMonthlyPurchaseEntries(supplierId, month, year),
      this.getMonthlyPayments(supplierId, month, year),
      this.getPreviousBalance(supplierId, month, year),
    ]);
    const currentMonthAmount = entries.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const totalPaid = payments.reduce((sum, entry) => sum + Number(entry.amount), 0);
    const totalPayable = previousBalance + currentMonthAmount;
    return { currentMonthAmount, previousBalance, totalPayable, totalPaid, remaining: totalPayable - totalPaid };
  },
};
