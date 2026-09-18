import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { ApiResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { SyncQueueService } from '../services/syncQueue.service';

function toNum(val: any, defaultVal = 0): number {
  const n = Number(val);
  return isNaN(n) || !isFinite(n) ? defaultVal : n;
}

function computePersonMetrics(person: any) {
  const txns = person.transactions || [];
  const nonOpening = txns.filter((t: any) => t.transactionType !== 'Opening Balance');

  const totalReceived = nonOpening
    .filter((t: any) => t.transactionType === 'Receive Amount')
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

  const totalPaid = nonOpening
    .filter((t: any) => t.transactionType === 'Pay Amount')
    .reduce((sum: number, t: any) => sum + (t.amount || 0), 0);

  const remaining =
    person.type === 'Incoming'
      ? person.openingBalance + totalPaid - totalReceived
      : person.openingBalance + totalReceived - totalPaid;

  return {
    ...person,
    id: String(person.id),
    totalReceived,
    totalPaid,
    balance: remaining,
  };
}

export class CashbookController {
  /**
   * List all cash persons with balance calculations
   */
  static async getCashPersons(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const persons = await prisma.cashPerson.findMany({
        orderBy: [{ status: 'asc' }, { id: 'desc' }],
        include: {
          transactions: {
            select: {
              id: true,
              transactionType: true,
              amount: true,
            },
          },
        },
      });

      const formatted = persons.map((p) => computePersonMetrics(p));
      return ApiResponse.success(res, 'Cash persons fetched successfully.', formatted);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get single cash person by ID
   */
  static async getCashPersonById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return ApiResponse.error(res, 'Invalid person ID.', 400);

      const person = await prisma.cashPerson.findUnique({
        where: { id },
        include: {
          transactions: true,
        },
      });

      if (!person) return ApiResponse.error(res, 'Cash person not found.', 404);

      return ApiResponse.success(res, 'Cash person fetched.', computePersonMetrics(person));
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create a new cash person and automatically create an Opening Balance transaction
   */
  static async createCashPerson(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { name, phone, address, type, description, openingBalance, customerType } = req.body;

      if (!name || !name.trim()) {
        return ApiResponse.error(res, 'Name is required.', 400);
      }
      if (!['Incoming', 'Outgoing'].includes(type)) {
        return ApiResponse.error(res, 'Type must be Incoming or Outgoing.', 400);
      }
      if (!['Debtor', 'Creditor'].includes(customerType)) {
        return ApiResponse.error(res, 'Customer type must be Debtor or Creditor.', 400);
      }

      const balanceNum = Math.max(0, toNum(openingBalance, 0));
      const today = new Date().toISOString().slice(0, 10);
      const creatorName = req.user?.email ? req.user.email.split('@')[0] : 'Admin';

      const result = await prisma.$transaction(async (tx) => {
        const person = await tx.cashPerson.create({
          data: {
            name: name.trim(),
            phone: phone ? phone.trim() : null,
            address: address ? address.trim() : null,
            type,
            description: description ? description.trim() : null,
            openingBalance: balanceNum,
            customerType,
            status: 'Active',
          },
        });

        // Create opening transaction
        const openingTxn = await tx.cashbookTransaction.create({
          data: {
            cashPersonId: person.id,
            cashPersonName: person.name,
            transactionType: 'Opening Balance',
            amount: balanceNum,
            description: 'Opening balance set',
            date: today,
            createdBy: creatorName,
          },
        });

        await SyncQueueService.enqueueCreate(tx, 'CashPerson', person.id, person, 0);
        await SyncQueueService.enqueueCreate(tx, 'CashbookTransaction', openingTxn.id, openingTxn, 1);

        return person;
      });

      return ApiResponse.success(res, 'Cash person created successfully.', {
        ...result,
        id: String(result.id),
      }, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Update mutable fields on a cash person
   */
  static async updateCashPerson(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return ApiResponse.error(res, 'Invalid person ID.', 400);

      const { name, phone, address, description, status } = req.body;
      const data: any = {};
      if (name !== undefined) data.name = name.trim();
      if (phone !== undefined) data.phone = phone ? phone.trim() : null;
      if (address !== undefined) data.address = address ? address.trim() : null;
      if (description !== undefined) data.description = description ? description.trim() : null;
      if (status !== undefined) data.status = status;

      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.cashPerson.update({
          where: { id },
          data,
        });
        await SyncQueueService.enqueueUpdate(tx, 'CashPerson', u.id, u, 0, 'UPDATE');
        return u;
      });

      return ApiResponse.success(res, 'Cash person updated.', {
        ...updated,
        id: String(updated.id),
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Toggle status (Active <-> Disabled)
   */
  static async toggleStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return ApiResponse.error(res, 'Invalid person ID.', 400);

      const person = await prisma.cashPerson.findUnique({ where: { id } });
      if (!person) return ApiResponse.error(res, 'Cash person not found.', 404);

      const newStatus = person.status === 'Active' ? 'Disabled' : 'Active';
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.cashPerson.update({
          where: { id },
          data: { status: newStatus },
        });
        await SyncQueueService.enqueueUpdate(tx, 'CashPerson', u.id, u, 0, 'UPDATE');
        return u;
      });

      return ApiResponse.success(
        res,
        newStatus === 'Disabled' ? 'Cash person disabled.' : 'Cash person re-enabled.',
        { ...updated, id: String(updated.id) }
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get ledger entries for a single person with running balance
   */
  static async getCashPersonLedger(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return ApiResponse.error(res, 'Invalid person ID.', 400);

      const person = await prisma.cashPerson.findUnique({ where: { id } });
      if (!person) return ApiResponse.error(res, 'Cash person not found.', 404);

      const txns = await prisma.cashbookTransaction.findMany({
        where: { cashPersonId: id },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });

      let runningBalance = 0;
      const entries = txns.map((t) => {
        let amountIn = 0;
        let amountOut = 0;

        if (t.transactionType === 'Opening Balance') {
          amountIn = t.amount;
          runningBalance = t.amount;
        } else if (t.transactionType === 'Receive Amount') {
          amountIn = t.amount;
          if (person.type === 'Incoming') {
            // Incoming person paid us -> what they owe us decreases
            runningBalance -= t.amount;
          } else {
            // Outgoing person gave us cash / loan -> what we owe them increases
            runningBalance += t.amount;
          }
        } else if (t.transactionType === 'Pay Amount') {
          amountOut = t.amount;
          if (person.type === 'Incoming') {
            // We gave cash to an incoming person -> what they owe us increases
            runningBalance += t.amount;
          } else {
            // We paid an outgoing person -> what we owe them decreases
            runningBalance -= t.amount;
          }
        }

        return {
          id: String(t.id),
          date: t.date,
          description: t.description || t.transactionType,
          transactionType: t.transactionType,
          amountIn,
          amountOut,
          runningBalance,
          createdBy: t.createdBy,
        };
      });

      return ApiResponse.success(res, 'Ledger entries fetched.', entries);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Record a new Receive Amount or Pay Amount transaction
   */
  static async addTransaction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { cashPersonId, transactionType, amount, description, date } = req.body;
      const personId = parseInt(cashPersonId, 10);

      if (isNaN(personId)) return ApiResponse.error(res, 'Valid cashPersonId is required.', 400);
      if (!['Receive Amount', 'Pay Amount'].includes(transactionType)) {
        return ApiResponse.error(res, 'Invalid transaction type.', 400);
      }

      const numAmount = toNum(amount, 0);
      if (numAmount <= 0) {
        return ApiResponse.error(res, 'Amount must be greater than zero.', 400);
      }

      const person = await prisma.cashPerson.findUnique({ where: { id: personId } });
      if (!person) return ApiResponse.error(res, 'Cash person not found.', 404);
      if (person.status === 'Disabled') {
        return ApiResponse.error(res, 'Cannot record transaction for a disabled cash person.', 400);
      }

      const creatorName = req.user?.email ? req.user.email.split('@')[0] : 'Admin';
      const txnDate = date || new Date().toISOString().slice(0, 10);

      const txn = await prisma.$transaction(async (tx) => {
        const newTxn = await tx.cashbookTransaction.create({
          data: {
            cashPersonId: personId,
            cashPersonName: person.name,
            transactionType,
            amount: numAmount,
            description: description ? description.trim() : null,
            date: txnDate,
            createdBy: creatorName,
          },
        });

        // Touch person updatedAt
        const updatedPerson = await tx.cashPerson.update({
          where: { id: personId },
          data: { updatedAt: new Date() },
        });

        await SyncQueueService.enqueueUpdate(tx, 'CashPerson', updatedPerson.id, updatedPerson, 0, 'UPDATE');
        await SyncQueueService.enqueueCreate(tx, 'CashbookTransaction', newTxn.id, newTxn, 1);

        return newTxn;
      });

      return ApiResponse.success(res, 'Transaction recorded successfully.', {
        ...txn,
        id: String(txn.id),
        cashPersonId: String(txn.cashPersonId),
      }, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Filter and list all transactions across persons
   */
  static async getTransactions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { personId, type, dateRange, fromDate, toDate } = req.query as Record<string, string>;

      const where: any = {};

      if (personId) {
        const pId = parseInt(personId, 10);
        if (!isNaN(pId)) where.cashPersonId = pId;
      }

      if (type && type !== 'All') {
        if (type === 'Received') {
          where.transactionType = 'Receive Amount';
        } else if (type === 'Paid') {
          where.transactionType = 'Pay Amount';
        } else if (type === 'Incoming' || type === 'Outgoing') {
          where.cashPerson = { type };
        }
      }

      if (dateRange && dateRange !== 'Custom') {
        const now = new Date();
        if (dateRange === 'Today') {
          where.date = now.toISOString().slice(0, 10);
        } else if (dateRange === 'This Week') {
          const day = now.getDay();
          const from = new Date(now);
          from.setDate(now.getDate() - day);
          const to = new Date(from);
          to.setDate(from.getDate() + 6);
          where.date = {
            gte: from.toISOString().slice(0, 10),
            lte: to.toISOString().slice(0, 10),
          };
        } else if (dateRange === 'This Month') {
          const from = new Date(now.getFullYear(), now.getMonth(), 1);
          const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          where.date = {
            gte: from.toISOString().slice(0, 10),
            lte: to.toISOString().slice(0, 10),
          };
        }
      } else if (dateRange === 'Custom' && fromDate && toDate) {
        where.date = {
          gte: fromDate,
          lte: toDate,
        };
      }

      const txns = await prisma.cashbookTransaction.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      });

      const formatted = txns.map((t) => ({
        ...t,
        id: String(t.id),
        cashPersonId: String(t.cashPersonId),
      }));

      return ApiResponse.success(res, 'Transactions fetched successfully.', formatted);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Aggregate informational summary
   */
  static async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const persons = await prisma.cashPerson.findMany({
        include: {
          transactions: {
            select: {
              transactionType: true,
              amount: true,
            },
          },
        },
      });

      let totalToReceive = 0;
      let totalToPay = 0;
      let totalReceived = 0;
      let totalPaid = 0;
      let activeCashPersons = 0;

      for (const p of persons) {
        if (p.status === 'Active') activeCashPersons++;

        const nonOpening = p.transactions.filter((t) => t.transactionType !== 'Opening Balance');
        const rec = nonOpening
          .filter((t) => t.transactionType === 'Receive Amount')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        const paid = nonOpening
          .filter((t) => t.transactionType === 'Pay Amount')
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        const balance =
          p.type === 'Incoming'
            ? p.openingBalance + paid - rec
            : p.openingBalance + rec - paid;

        if (p.type === 'Incoming') {
          totalToReceive += balance;
          totalReceived += rec;
        } else {
          totalToPay += balance;
          totalPaid += paid;
        }
      }

      return ApiResponse.success(res, 'Cashbook summary fetched.', {
        totalToReceive,
        totalToPay,
        totalReceived,
        totalPaid,
        activeCashPersons,
        netBalance: totalToReceive - totalToPay,
      });
    } catch (err) {
      next(err);
    }
  }
}
