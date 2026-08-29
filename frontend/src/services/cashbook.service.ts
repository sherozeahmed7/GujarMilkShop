/**
 * Cashbook Service — Mock Implementation (localStorage)
 *
 * Implements ICashbookRepository using localStorage for offline-first
 * frontend development. When the backend is ready, replace this file
 * with an API-based implementation of ICashbookRepository.
 *
 * ACCOUNTING ISOLATION:
 * This service is 100% independent from:
 *   - POS / Sales
 *   - Cash Register balances
 *   - Customer / Supplier Ledger
 *   - Inventory
 *   - Expenses
 *   - Profit & Loss calculations
 * Cashbook values are INFORMATIONAL ONLY.
 */
import { ICashbookRepository } from '../repositories/cashbook.repository';
import {
  CashPerson,
  CashbookTransaction,
  CashPersonLedgerEntry,
  CashbookSummary,
  CreateCashPersonPayload,
  AddTransactionPayload,
  CashbookTransactionFilters,
} from '../types/cashbook';
import { activityLogger } from './activityLogger';

const PERSONS_KEY = 'gujar_pos_cashbook_persons';
const TRANSACTIONS_KEY = 'gujar_pos_cashbook_transactions';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const genId = (prefix: string) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const now = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);

const getPersons = (): CashPerson[] => {
  try {
    return JSON.parse(localStorage.getItem(PERSONS_KEY) || '[]');
  } catch {
    return [];
  }
};

const savePersons = (persons: CashPerson[]) =>
  localStorage.setItem(PERSONS_KEY, JSON.stringify(persons));

const getTransactions = (): CashbookTransaction[] => {
  try {
    return JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  } catch {
    return [];
  }
};

const saveTransactions = (txns: CashbookTransaction[]) =>
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(txns));

const currentUser = () =>
  localStorage.getItem('userName') || localStorage.getItem('role') || 'Admin';

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_PERSONS: CashPerson[] = [
  {
    id: 'cp_seed_001',
    name: 'Ali Raza',
    phone: '03001234567',
    address: 'Mohalla Gujjar, Lahore',
    type: 'Incoming',
    description: 'Regular milk supplier advance',
    openingBalance: 15000,
    customerType: 'Debtor',
    status: 'Active',
    createdAt: '2026-08-01T09:00:00.000Z',
    updatedAt: '2026-08-01T09:00:00.000Z',
  },
  {
    id: 'cp_seed_002',
    name: 'Ahmed Khan',
    phone: '03211234567',
    address: 'Street 5, Faisalabad',
    type: 'Outgoing',
    description: 'Equipment rental payment pending',
    openingBalance: 20000,
    customerType: 'Creditor',
    status: 'Active',
    createdAt: '2026-08-05T10:00:00.000Z',
    updatedAt: '2026-08-05T10:00:00.000Z',
  },
  {
    id: 'cp_seed_003',
    name: 'Sara Bibi',
    phone: '03331234567',
    address: 'Gulshan Colony, Multan',
    type: 'Incoming',
    description: 'Old dues from shop partnership',
    openingBalance: 8000,
    customerType: 'Debtor',
    status: 'Active',
    createdAt: '2026-08-10T11:00:00.000Z',
    updatedAt: '2026-08-10T11:00:00.000Z',
  },
  {
    id: 'cp_seed_004',
    name: 'Usman Ghani',
    phone: '',
    address: '',
    type: 'Outgoing',
    description: 'Labour payment - seasonal',
    openingBalance: 5000,
    customerType: 'Creditor',
    status: 'Disabled',
    createdAt: '2026-07-15T08:00:00.000Z',
    updatedAt: '2026-08-20T08:00:00.000Z',
  },
];

const SEED_TRANSACTIONS: CashbookTransaction[] = [
  // Ali Raza — opening + 2 payments
  {
    id: 'ct_seed_001',
    cashPersonId: 'cp_seed_001',
    cashPersonName: 'Ali Raza',
    transactionType: 'Opening Balance',
    amount: 15000,
    description: 'Opening balance set',
    date: '2026-08-01',
    createdBy: 'Admin',
    createdAt: '2026-08-01T09:00:00.000Z',
  },
  {
    id: 'ct_seed_002',
    cashPersonId: 'cp_seed_001',
    cashPersonName: 'Ali Raza',
    transactionType: 'Receive Amount',
    amount: 5000,
    description: 'Partial payment received',
    date: '2026-08-10',
    createdBy: 'Admin',
    createdAt: '2026-08-10T14:00:00.000Z',
  },
  {
    id: 'ct_seed_003',
    cashPersonId: 'cp_seed_001',
    cashPersonName: 'Ali Raza',
    transactionType: 'Receive Amount',
    amount: 3000,
    description: 'Second instalment',
    date: '2026-08-20',
    createdBy: 'Admin',
    createdAt: '2026-08-20T11:00:00.000Z',
  },
  // Ahmed Khan — opening + payment made
  {
    id: 'ct_seed_004',
    cashPersonId: 'cp_seed_002',
    cashPersonName: 'Ahmed Khan',
    transactionType: 'Opening Balance',
    amount: 20000,
    description: 'Opening balance set',
    date: '2026-08-05',
    createdBy: 'Admin',
    createdAt: '2026-08-05T10:00:00.000Z',
  },
  {
    id: 'ct_seed_005',
    cashPersonId: 'cp_seed_002',
    cashPersonName: 'Ahmed Khan',
    transactionType: 'Pay Amount',
    amount: 8000,
    description: 'First instalment paid',
    date: '2026-08-15',
    createdBy: 'Admin',
    createdAt: '2026-08-15T09:30:00.000Z',
  },
  // Sara Bibi — opening only
  {
    id: 'ct_seed_006',
    cashPersonId: 'cp_seed_003',
    cashPersonName: 'Sara Bibi',
    transactionType: 'Opening Balance',
    amount: 8000,
    description: 'Opening balance set',
    date: '2026-08-10',
    createdBy: 'Admin',
    createdAt: '2026-08-10T11:00:00.000Z',
  },
  // Usman Ghani — opening
  {
    id: 'ct_seed_007',
    cashPersonId: 'cp_seed_004',
    cashPersonName: 'Usman Ghani',
    transactionType: 'Opening Balance',
    amount: 5000,
    description: 'Opening balance set',
    date: '2026-07-15',
    createdBy: 'Admin',
    createdAt: '2026-07-15T08:00:00.000Z',
  },
];

const seedIfEmpty = () => {
  if (getPersons().length === 0) {
    savePersons(SEED_PERSONS);
    saveTransactions(SEED_TRANSACTIONS);
  }
};

// ─── Balance Calculation ──────────────────────────────────────────────────────

/**
 * Calculates the current remaining balance for a cash person.
 *
 * For a Debtor (they owe us — Incoming person):
 *   balance = openingBalance + additionalIncoming - totalReceived
 *
 * For a Creditor (we owe them — Outgoing person):
 *   balance = openingBalance + additionalOutgoing - totalPaid
 */
const calculatePersonBalance = (
  person: CashPerson,
  transactions: CashbookTransaction[]
): { totalReceived: number; totalPaid: number; balance: number } => {
  const personTxns = transactions.filter(
    (t) => t.cashPersonId === person.id && t.transactionType !== 'Opening Balance'
  );
  const totalReceived = personTxns
    .filter((t) => t.transactionType === 'Receive Amount')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalPaid = personTxns
    .filter((t) => t.transactionType === 'Pay Amount')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = Math.max(0, person.openingBalance + (totalReceived > 0 ? 0 : 0) - (person.type === 'Incoming' ? totalReceived : totalPaid));
  // Proper formula:
  // Incoming person: balance = openingBalance - totalReceived (they owed us; each receive reduces)
  // Outgoing person: balance = openingBalance - totalPaid   (we owed them; each payment reduces)
  const remaining =
    person.type === 'Incoming'
      ? Math.max(0, person.openingBalance - totalReceived)
      : Math.max(0, person.openingBalance - totalPaid);

  return { totalReceived, totalPaid, balance: remaining };
};

// ─── Date Helpers ─────────────────────────────────────────────────────────────

const toDateObj = (dateStr: string) => new Date(dateStr + 'T00:00:00');

const getDateRange = (range: 'Today' | 'This Week' | 'This Month'): { from: Date; to: Date } => {
  const now = new Date();
  if (range === 'Today') {
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    return { from, to };
  }
  if (range === 'This Week') {
    const day = now.getDay(); // 0=Sun
    const from = new Date(now);
    from.setDate(now.getDate() - day);
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(from.getDate() + 6);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }
  // This Month
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { from, to };
};

// ─── Service Implementation ───────────────────────────────────────────────────

class CashbookService implements ICashbookRepository {
  constructor() {
    seedIfEmpty();
  }

  async getCashPersons(): Promise<CashPerson[]> {
    seedIfEmpty();
    return getPersons();
  }

  async getCashPersonById(id: string): Promise<CashPerson | undefined> {
    return getPersons().find((p) => p.id === id);
  }

  async createCashPerson(data: CreateCashPersonPayload): Promise<CashPerson> {
    const persons = getPersons();
    const timestamp = now();
    const person: CashPerson = {
      id: genId('cp'),
      name: data.name.trim(),
      phone: data.phone?.trim() || '',
      address: data.address?.trim() || '',
      type: data.type,
      description: data.description?.trim() || '',
      openingBalance: data.openingBalance,
      customerType: data.customerType,
      status: 'Active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    persons.push(person);
    savePersons(persons);

    // Auto-create Opening Balance transaction
    const txns = getTransactions();
    const openingTxn: CashbookTransaction = {
      id: genId('ct'),
      cashPersonId: person.id,
      cashPersonName: person.name,
      transactionType: 'Opening Balance',
      amount: data.openingBalance,
      description: 'Opening balance set',
      date: today(),
      createdBy: currentUser(),
      createdAt: timestamp,
    };
    txns.push(openingTxn);
    saveTransactions(txns);

    activityLogger.log({
      action: 'Cash Person Created',
      module: 'Cashbook',
      description: `Created cash person "${person.name}" (${person.type}, ${person.customerType}) with opening balance Rs. ${data.openingBalance.toLocaleString()}`,
      entityId: person.id,
      status: 'Success',
    });

    return person;
  }

  async updateCashPerson(id: string, data: Partial<CashPerson>): Promise<CashPerson> {
    const persons = getPersons();
    const idx = persons.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error(`Cash person ${id} not found`);
    persons[idx] = { ...persons[idx], ...data, updatedAt: now() };
    savePersons(persons);
    return persons[idx];
  }

  async disableCashPerson(id: string): Promise<CashPerson> {
    const person = await this.updateCashPerson(id, { status: 'Disabled' });
    activityLogger.log({
      action: 'Cash Person Disabled',
      module: 'Cashbook',
      description: `Disabled cash person "${person.name}". Historical records preserved.`,
      entityId: id,
      status: 'Warning',
    });
    return person;
  }

  async enableCashPerson(id: string): Promise<CashPerson> {
    const person = await this.updateCashPerson(id, { status: 'Active' });
    activityLogger.log({
      action: 'Cash Person Enabled',
      module: 'Cashbook',
      description: `Re-enabled cash person "${person.name}".`,
      entityId: id,
      status: 'Success',
    });
    return person;
  }

  async getCashPersonLedger(personId: string): Promise<CashPersonLedgerEntry[]> {
    const person = await this.getCashPersonById(personId);
    if (!person) return [];

    const txns = getTransactions()
      .filter((t) => t.cashPersonId === personId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    let runningBalance = 0;
    const entries: CashPersonLedgerEntry[] = txns.map((t) => {
      let amountIn = 0;
      let amountOut = 0;

      if (t.transactionType === 'Opening Balance') {
        amountIn = t.amount;
        runningBalance = t.amount;
      } else if (t.transactionType === 'Receive Amount') {
        // Money received from them → reduces what they owe us
        amountIn = t.amount;
        runningBalance = Math.max(0, runningBalance - t.amount);
      } else if (t.transactionType === 'Pay Amount') {
        // Money paid to them → reduces what we owe them
        amountOut = t.amount;
        runningBalance = Math.max(0, runningBalance - t.amount);
      }

      return {
        id: t.id,
        date: t.date,
        description: t.description || t.transactionType,
        transactionType: t.transactionType,
        amountIn,
        amountOut,
        runningBalance,
        createdBy: t.createdBy,
      };
    });

    activityLogger.log({
      action: 'Cash Person Ledger Viewed',
      module: 'Cashbook',
      description: `Viewed ledger for cash person "${person.name}"`,
      entityId: personId,
      status: 'Success',
    });

    return entries;
  }

  async addCashbookTransaction(data: AddTransactionPayload): Promise<CashbookTransaction> {
    if (data.amount <= 0) throw new Error('Amount must be greater than zero.');

    const person = await this.getCashPersonById(data.cashPersonId);
    if (!person) throw new Error('Cash person not found.');
    if (person.status === 'Disabled')
      throw new Error('Cannot record a transaction for a disabled cash person.');

    const txns = getTransactions();
    const txn: CashbookTransaction = {
      id: genId('ct'),
      cashPersonId: data.cashPersonId,
      cashPersonName: person.name,
      transactionType: data.transactionType,
      amount: data.amount,
      description: data.description?.trim() || '',
      date: data.date,
      createdBy: currentUser(),
      createdAt: now(),
    };
    txns.push(txn);
    saveTransactions(txns);

    // Update person updatedAt
    await this.updateCashPerson(data.cashPersonId, {});

    activityLogger.log({
      action: data.transactionType === 'Receive Amount' ? 'Amount Received' : 'Amount Paid',
      module: 'Cashbook',
      description: `${data.transactionType} of Rs. ${data.amount.toLocaleString()} for "${person.name}"${data.description ? ` — ${data.description}` : ''}`,
      entityId: txn.id,
      status: 'Success',
    });

    return txn;
  }

  async getCashbookTransactions(filters?: CashbookTransactionFilters): Promise<CashbookTransaction[]> {
    let txns = getTransactions().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (!filters) return txns;

    // Filter by person
    if (filters.personId) {
      txns = txns.filter((t) => t.cashPersonId === filters.personId);
    }

    // Filter by type
    if (filters.type && filters.type !== 'All') {
      const persons = getPersons();
      if (filters.type === 'Incoming') {
        const incomingIds = new Set(persons.filter((p) => p.type === 'Incoming').map((p) => p.id));
        txns = txns.filter((t) => incomingIds.has(t.cashPersonId));
      } else if (filters.type === 'Outgoing') {
        const outgoingIds = new Set(persons.filter((p) => p.type === 'Outgoing').map((p) => p.id));
        txns = txns.filter((t) => outgoingIds.has(t.cashPersonId));
      } else if (filters.type === 'Received') {
        txns = txns.filter((t) => t.transactionType === 'Receive Amount');
      } else if (filters.type === 'Paid') {
        txns = txns.filter((t) => t.transactionType === 'Pay Amount');
      }
    }

    // Filter by date
    if (filters.dateRange && filters.dateRange !== 'Custom') {
      const { from, to } = getDateRange(filters.dateRange);
      txns = txns.filter((t) => {
        const d = toDateObj(t.date);
        return d >= from && d <= to;
      });
    } else if (filters.dateRange === 'Custom' && filters.fromDate && filters.toDate) {
      const from = toDateObj(filters.fromDate);
      const to = toDateObj(filters.toDate);
      to.setHours(23, 59, 59);
      txns = txns.filter((t) => {
        const d = toDateObj(t.date);
        return d >= from && d <= to;
      });
    }

    return txns;
  }

  async getCashbookSummary(): Promise<CashbookSummary> {
    const persons = getPersons();
    const txns = getTransactions();

    let totalToReceive = 0;
    let totalToPay = 0;
    let totalReceived = 0;
    let totalPaid = 0;
    let activeCashPersons = 0;

    for (const person of persons) {
      if (person.status === 'Active') activeCashPersons++;

      const { totalReceived: rec, totalPaid: paid, balance } = calculatePersonBalance(person, txns);

      if (person.type === 'Incoming') {
        totalToReceive += balance;
        totalReceived += rec;
      } else {
        totalToPay += balance;
        totalPaid += paid;
      }
    }

    return {
      totalToReceive,
      totalToPay,
      totalReceived,
      totalPaid,
      activeCashPersons,
      netBalance: totalToReceive - totalToPay,
    };
  }
}

/** Singleton service instance — replace this with an API implementation when backend is ready. */
export const cashbookService: ICashbookRepository = new CashbookService();

/** Convenience re-export of individual service methods for direct import. */
export const getCashPersons = () => cashbookService.getCashPersons();
export const getCashPersonById = (id: string) => cashbookService.getCashPersonById(id);
export const createCashPerson = (data: CreateCashPersonPayload) => cashbookService.createCashPerson(data);
export const updateCashPerson = (id: string, data: Partial<CashPerson>) => cashbookService.updateCashPerson(id, data);
export const disableCashPerson = (id: string) => cashbookService.disableCashPerson(id);
export const enableCashPerson = (id: string) => cashbookService.enableCashPerson(id);
export const getCashPersonLedger = (id: string) => cashbookService.getCashPersonLedger(id);
export const addCashbookTransaction = (data: AddTransactionPayload) => cashbookService.addCashbookTransaction(data);
export const getCashbookTransactions = (filters?: CashbookTransactionFilters) => cashbookService.getCashbookTransactions(filters);
export const getCashbookSummary = () => cashbookService.getCashbookSummary();
