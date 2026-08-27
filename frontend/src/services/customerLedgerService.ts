import { apiClient } from './apiClient';
import { SaleRecord } from './sale.service';

export interface MilkEntry {
  id: string;
  customerId: string;
  date: string;
  quantity: number;
  rate: number;
  amount: number;
  time: string;
  product?: string;
  notes?: string;
}

export interface PaymentEntry {
  id: string;
  customerId: string;
  date: string;
  amount: number;
  paymentMethod: string;
  reference: string;
  addedBy: string;
}

export interface LedgerSummary {
  totalMilk: number;
  currentMonthAmount: number;
  previousBalance: number;
  totalPayable: number;
  totalReceived: number;
  remaining: number;
}

const money = (value: number) => Math.round(value * 100) / 100;
const monthRange = (month: number, year: number) => ({
  start: new Date(year, month - 1, 1, 0, 0, 0, 0),
  end: new Date(year, month, 0, 23, 59, 59, 999),
});
const localDateKey = (value: string | Date) => {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const mockDate = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const mockEntries = (customerId: string, month: number, year: number): MilkEntry[] => [
  { id: `mock-${customerId}-${year}-${month}-01a`, customerId, date: mockDate(year, month, 1), quantity: 2.5, rate: 240, amount: 600, time: '08:30', product: 'milk' },
  { id: `mock-${customerId}-${year}-${month}-01b`, customerId, date: mockDate(year, month, 1), quantity: 1, rate: 240, amount: 240, time: '18:00', product: 'milk' },
  { id: `mock-${customerId}-${year}-${month}-05`, customerId, date: mockDate(year, month, 5), quantity: 3, rate: 240, amount: 720, time: '08:00', product: 'milk' },
  { id: `mock-${customerId}-${year}-${month}-12`, customerId, date: mockDate(year, month, 12), quantity: 2, rate: 245, amount: 490, time: '09:00', product: 'milk' },
  { id: `mock-${customerId}-${year}-${month}-20`, customerId, date: mockDate(year, month, 20), quantity: 1.5, rate: 245, amount: 367.5, time: '08:30', product: 'milk' },
];
const mockPayments = (customerId: string, month: number, year: number): PaymentEntry[] => [
  { id: `mock-payment-${customerId}-${year}-${month}-01`, customerId, date: mockDate(year, month, 10), amount: 1000, paymentMethod: 'cash', reference: 'MOCK-PAY-001', addedBy: 'System Admin' },
];
const mockCustomer = (customerId: string) => ({ id: customerId, name: 'Ahmed (Demo)', phone: '0316-8517824', customerType: 'monthly_ledger', type: 'Monthly', address: 'Main Bazar', balance: 2123 });

async function getSales(customerId: string, from?: Date, to?: Date): Promise<SaleRecord[]> {
  const sales = await apiClient.get('/sales', {
    customerId: Number(customerId),
    ...(from ? { fromDate: from.toISOString() } : {}),
    ...(to ? { toDate: to.toISOString() } : {}),
  });
  return (sales.data || []) as SaleRecord[];
}

function getMilkItems(sales: SaleRecord[], customerId: string): MilkEntry[] {
  return sales.flatMap((sale) => (sale.items || [])
    .filter((item) => ['milk', 'yogurt'].includes(item.itemName.toLowerCase()))
    .map((item) => ({
      id: `sale-${sale.id}-item-${item.id}`,
      customerId,
      date: localDateKey(sale.createdAt),
      quantity: Number(item.quantity),
      rate: Number(item.unitPrice),
      amount: Number(item.totalPrice),
      time: new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      product: item.itemName,
    })));
}

function getPayments(sales: SaleRecord[], customerId: string): PaymentEntry[] {
  return sales.flatMap((sale) => (sale.payments || [])
    .filter((payment) => Number(payment.amount) > 0)
    .map((payment) => ({
      id: String(payment.id),
      customerId,
      date: localDateKey(payment.createdAt),
      amount: Number(payment.amount),
      paymentMethod: payment.method,
      reference: `SALE-${sale.id}`,
      addedBy: 'System',
    })));
}

export const customerLedgerService = {
  async getCustomer(customerId: string) {
    try {
      const response = await apiClient.get(`/customers/${customerId}`);
      const customer = response.data;
      return { ...customer, id: String(customer.id), type: customer.customerType === 'monthly_ledger' ? 'Monthly' : 'Daily', balance: 0 };
    } catch { return mockCustomer(customerId); }
  },

  async getMonthlyMilkEntries(customerId: string, month: number, year: number): Promise<MilkEntry[]> {
    const range = monthRange(month, year);
    try { return getMilkItems(await getSales(customerId, range.start, range.end), customerId); }
    catch { return mockEntries(customerId, month, year); }
  },

  async getMonthlyPayments(customerId: string, month: number, year: number): Promise<PaymentEntry[]> {
    const range = monthRange(month, year);
    try { return getPayments(await getSales(customerId, range.start, range.end), customerId); }
    catch { return mockPayments(customerId, month, year); }
  },

  async getPreviousBalance(customerId: string, month: number, year: number): Promise<number> {
    const range = monthRange(month, year);
    try {
      const historicalSales = await getSales(customerId, undefined, new Date(range.start.getTime() - 1));
      const billed = historicalSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
      const paid = getPayments(historicalSales, customerId).reduce((sum, payment) => sum + payment.amount, 0);
      return money(billed - paid);
    } catch { return month === 1 ? 5000 : 5000; }
  },

  async getMonthlySummary(customerId: string, month: number, year: number): Promise<LedgerSummary> {
    const [entries, payments, previousBalance] = await Promise.all([
      this.getMonthlyMilkEntries(customerId, month, year),
      this.getMonthlyPayments(customerId, month, year),
      this.getPreviousBalance(customerId, month, year),
    ]);
    const currentMonthAmount = money(entries.reduce((sum, entry) => sum + entry.amount, 0));
    const totalReceived = money(payments.reduce((sum, payment) => sum + payment.amount, 0));
    const totalPayable = money(previousBalance + currentMonthAmount);
    return { totalMilk: money(entries.reduce((sum, entry) => sum + entry.quantity, 0)), currentMonthAmount, previousBalance, totalPayable, totalReceived, remaining: money(totalPayable - totalReceived) };
  },
};
