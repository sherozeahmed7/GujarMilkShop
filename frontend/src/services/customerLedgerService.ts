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

async function getSales(customerId: string, from?: Date, to?: Date): Promise<SaleRecord[]> {
  const sales = await apiClient.get('/sales', {
    customerId: Number(customerId),
    limit: 0,
    ...(from ? { fromDate: from.toISOString() } : {}),
    ...(to ? { toDate: to.toISOString() } : {}),
  });
  return (sales.data || []) as SaleRecord[];
}

function getMilkItems(sales: SaleRecord[], customerId: string): MilkEntry[] {
  return sales.flatMap((sale) => (sale.items || [])
    .filter((item) => ['milk', 'yogurt'].includes((item.itemName || '').toLowerCase()))
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
    const response = await apiClient.get(`/customers/${customerId}`);
    const customer = response.data;
    if (!customer) throw new Error(`Customer ${customerId} not found`);
    return { ...customer, id: String(customer.id), type: customer.customerType === 'monthly_ledger' ? 'Monthly' : 'Daily', balance: Number(customer.balance || 0) };
  },

  async getMonthlyMilkEntries(customerId: string, month: number, year: number): Promise<MilkEntry[]> {
    const range = monthRange(month, year);
    const sales = await getSales(customerId, range.start, range.end);
    return getMilkItems(sales, customerId);
  },

  async getMonthlyPayments(customerId: string, month: number, year: number): Promise<PaymentEntry[]> {
    const range = monthRange(month, year);
    // Fetch all sales for this customer so payments made this month on previous sales are captured
    const allSales = await getSales(customerId);
    const allPayments = getPayments(allSales, customerId);
    return allPayments.filter((p) => {
      const pDate = new Date(p.date);
      return pDate >= range.start && pDate <= range.end;
    });
  },

  async getPreviousBalance(customerId: string, month: number, year: number): Promise<number> {
    const range = monthRange(month, year);
    // All sales billed before the start of this month
    const historicalSales = await getSales(customerId, undefined, new Date(range.start.getTime() - 1));
    const billed = historicalSales.reduce((sum, sale) => sum + Number(sale.totalAmount || 0), 0);
    // All payments made before the start of this month
    const allSales = await getSales(customerId);
    const allPayments = getPayments(allSales, customerId);
    const paidBeforeThisMonth = allPayments
      .filter((p) => new Date(p.date) < range.start)
      .reduce((sum, payment) => sum + payment.amount, 0);
    return money(billed - paidBeforeThisMonth);
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
