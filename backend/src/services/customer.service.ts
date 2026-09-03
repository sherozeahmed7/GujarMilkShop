import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
const CUSTOMER_TYPES = ['daily_ledger', 'monthly_ledger'] as const;
const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
const PAYMENT_METHODS = ['cash', 'online'] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Start of current billing period for a ledger customer (local calendar). */
function customerPeriodStart(customerType: string, now = new Date()): Date {
  if (customerType === 'daily_ledger') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
  // monthly_ledger (and fallback)
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

export interface CreateCustomerPayload {
  name: string;
  phone?: string;
  address?: string;
  customerType: string;
  /** Optional existing dues to seed as Previous balance */
  openingBalance?: number;
}

export interface UpdateCustomerPayload {
  name?: string;
  phone?: string;
  address?: string;
  customerType?: string;
  openingBalance?: number;
}

export class CustomerService {
  /**
   * Create a registered ledger customer.
   * Optional openingBalance creates a pending sale dated before the current
   * period so it appears in Previous and can be collected like normal dues.
   */
  static async createCustomer(payload: CreateCustomerPayload) {
    const { name, phone, address, customerType, openingBalance } = payload;

    if (!name || !name.trim()) {
      return {
        success: false,
        statusCode: 400,
        message: 'name is required.'
      };
    }

    if (!customerType || !(CUSTOMER_TYPES as readonly string[]).includes(customerType)) {
      return {
        success: false,
        statusCode: 400,
        message: `Invalid customerType. Allowed: ${CUSTOMER_TYPES.join(', ')}`
      };
    }

    const opening = money(Number(openingBalance) || 0);
    if (opening < 0) {
      return {
        success: false,
        statusCode: 400,
        message: 'openingBalance cannot be negative.'
      };
    }

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          name: name.trim(),
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          customerType,
          status: 'active'
        }
      });

      if (opening > 0) {
        const saleType =
          customerType === 'monthly_ledger' ? 'ledger_monthly' : 'ledger_daily';
        // One second before current period → always counts as Previous
        const periodStart = customerPeriodStart(customerType);
        const openingAt = new Date(periodStart.getTime() - 1000);

        const newSale = await tx.sale.create({
          data: {
            saleType,
            customerId: created.id,
            customerName: created.name,
            customerPhone: created.phone,
            totalAmount: opening,
            paidAmount: 0,
            remainingBalance: opening,
            status: 'pending',
            createdAt: openingAt,
            items: {
              create: [
                {
                  itemName: 'Opening Balance',
                  quantity: 1,
                  unitPrice: opening,
                  totalPrice: opening
                }
              ]
            },
            payments: {
              create: { method: 'cash', amount: 0, status: 'pending' }
            }
          },
          include: { items: true, payments: true }
        });

        await SyncQueueService.enqueueCreate(tx, 'Sale', newSale.id, newSale, 1);
        for (const item of newSale.items) {
          await SyncQueueService.enqueueCreate(tx, 'SaleItem', item.id, item, 2);
        }
        for (const payment of newSale.payments) {
          await SyncQueueService.enqueueCreate(tx, 'Payment', payment.id, payment, 2);
        }
      }

      await SyncQueueService.enqueueCreate(tx, 'Customer', created.id, created, 0);

      return created;
    });

    return {
      success: true,
      statusCode: 201,
      message: 'Customer created successfully.',
      data: customer
    };
  }

  /**
   * List registered ledger customers.
   * Query params:
   * - search: matches name or phone (case-insensitive contains)
   * - dues: true → only customers with pending/partial remaining balance (legacy)
   * - duesStatus: pending | paid (Paid/Pending filter; preferred over dues)
   * - customerType: daily_ledger | monthly_ledger
   * - status: active | inactive (default: active)
   * - fromDate / toDate (ISO): only customers with sales in range; period split uses fromDate
   * Each row includes currentDue, previousDue, totalDue, and lastSaleDate.
   * currentDue = billed in current period (or in selected date range).
   * previousDue = billed before that period / range start.
   */
  static async listCustomers(filters?: {
    status?: string;
    customerType?: string;
    search?: string;
    dues?: boolean;
    duesStatus?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const where: any = {};
    const andFilters: any[] = [];

    // Default to active customers unless status is explicitly provided
    where.status = filters?.status?.trim() || 'active';

    if (filters?.customerType) {
      if (!(CUSTOMER_TYPES as readonly string[]).includes(filters.customerType as any)) {
        return {
          success: false,
          statusCode: 400,
          message: `Invalid customerType. Allowed: ${CUSTOMER_TYPES.join(', ')}`
        };
      }
      where.customerType = filters.customerType;
    }

    const search = filters?.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } }
      ];
    }

    const duesStatus = filters?.duesStatus?.trim()?.toLowerCase();
    const openDuesFilter = {
      some: {
        status: { in: ['pending', 'partial'] },
        remainingBalance: { gt: 0 }
      }
    };
    const noOpenDuesFilter = {
      none: {
        status: { in: ['pending', 'partial'] },
        remainingBalance: { gt: 0 }
      }
    };

    if (duesStatus === 'pending' || filters?.dues) {
      andFilters.push({ sales: openDuesFilter });
    } else if (duesStatus === 'paid') {
      andFilters.push({ sales: noOpenDuesFilter });
    } else if (duesStatus && duesStatus !== 'all') {
      return {
        success: false,
        statusCode: 400,
        message: 'Invalid duesStatus. Allowed: pending, paid, all.'
      };
    }

    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;
    if (filters?.fromDate) {
      rangeStart = new Date(filters.fromDate);
      if (Number.isNaN(rangeStart.getTime())) {
        return { success: false, statusCode: 400, message: 'Invalid fromDate.' };
      }
    }
    if (filters?.toDate) {
      rangeEnd = new Date(filters.toDate);
      if (Number.isNaN(rangeEnd.getTime())) {
        return { success: false, statusCode: 400, message: 'Invalid toDate.' };
      }
    }

    if (rangeStart || rangeEnd) {
      const createdAt: any = {};
      if (rangeStart) createdAt.gte = rangeStart;
      if (rangeEnd) createdAt.lte = rangeEnd;
      andFilters.push({ sales: { some: { createdAt } } });
    }

    if (andFilters.length === 1) {
      Object.assign(where, andFilters[0]);
    } else if (andFilters.length > 1) {
      where.AND = andFilters;
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            remainingBalance: true,
            totalAmount: true,
            paidAmount: true,
            createdAt: true,
            status: true,
            items: {
              where: { itemName: 'Opening Balance' },
              select: { totalPrice: true }
            }
          }
        }
      }
    });

    const now = new Date();
    const data = customers.map((c) => {
      // When a date range is selected, "current" = sales inside that range
      const periodStart =
        rangeStart || customerPeriodStart(c.customerType, now);
      let currentAmount = 0;
      let previousAmount = 0;
      let paidAmount = 0;
      let remainingBalance = 0;

      for (const sale of c.sales) {
        paidAmount += sale.paidAmount || 0;
        if (
          (sale.status === 'pending' || sale.status === 'partial') &&
          sale.remainingBalance > 0
        ) {
          remainingBalance += sale.remainingBalance;
        }

        const inCurrent =
          sale.createdAt >= periodStart &&
          (!rangeEnd || sale.createdAt <= rangeEnd);

        if (inCurrent) currentAmount += sale.totalAmount || 0;
        else if (sale.createdAt < periodStart) previousAmount += sale.totalAmount || 0;
        // sales after rangeEnd (when filtering) are ignored for period columns
      }

      const openingSale = c.sales.find((s) => s.items && s.items.length > 0);
      const openingBalance = openingSale ? money(openingSale.totalAmount) : 0;

      currentAmount = money(currentAmount);
      previousAmount = money(previousAmount);
      paidAmount = money(paidAmount);
      remainingBalance = money(remainingBalance);
      const totalAmount = money(currentAmount + previousAmount);
      const lastSale = c.sales[0];

      const { sales: _sales, ...rest } = c;
      return {
        ...rest,
        openingBalance,
        currentDue: currentAmount,
        previousDue: previousAmount,
        totalAmount,
        paidAmount,
        remainingBalance,
        /** Open dues — same as remainingBalance */
        totalDue: remainingBalance,
        lastSaleDate: lastSale ? lastSale.createdAt.toISOString() : null
      };
    });

    return {
      success: true,
      statusCode: 200,
      data
    };
  }

  /**
   * Dashboard summary.
   * Default (no scope): Customers screen — mixes ledger + walk-in + split.
   * scope=ledger: Khata Ledger cards only — accounts, outstanding, collectedToday.
   */
  static async getCustomersSummary(scope?: string) {
    if (scope === 'ledger') {
      return CustomerService.getLedgerSummary();
    }

    const [activeLedgerCount, walkInCount, splitCount] = await Promise.all([
      prisma.customer.count({ where: { status: 'active' } }),
      prisma.sale.count({ where: { saleType: 'walk_in' } }),
      prisma.sale.count({ where: { saleType: 'split' } })
    ]);

    const totalRows = activeLedgerCount + walkInCount + splitCount;

    const [ledgerOutstandingAgg, splitOutstandingAgg] = await Promise.all([
      prisma.sale.aggregate({
        where: {
          saleType: { in: ['ledger_daily', 'ledger_monthly'] },
          status: { in: ['pending', 'partial'] },
          remainingBalance: { gt: 0 },
          customer: { status: 'active' }
        },
        _sum: { remainingBalance: true }
      }),
      prisma.sale.aggregate({
        where: {
          saleType: 'split',
          status: 'partial',
          remainingBalance: { gt: 0 }
        },
        _sum: { remainingBalance: true }
      })
    ]);

    const totalOutstanding = money(
      (ledgerOutstandingAgg._sum.remainingBalance || 0) +
        (splitOutstandingAgg._sum.remainingBalance || 0)
    );

    const [ledgerWithDues, splitWithDues] = await Promise.all([
      prisma.customer.count({
        where: {
          status: 'active',
          sales: {
            some: {
              status: { in: ['pending', 'partial'] },
              remainingBalance: { gt: 0 }
            }
          }
        }
      }),
      prisma.sale.count({
        where: {
          saleType: 'split',
          status: 'partial',
          remainingBalance: { gt: 0 }
        }
      })
    ]);

    const withDues = ledgerWithDues + splitWithDues;

    return {
      success: true,
      statusCode: 200,
      data: {
        totalRows,
        totalOutstanding,
        withDues,
        breakdown: {
          activeLedgerCount,
          walkInCount,
          splitCount,
          ledgerWithDues,
          splitWithDues
        }
      }
    };
  }

  /**
   * Khata Ledger summary cards (ledger customers only).
   */
  static async getLedgerSummary() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [khataAccounts, outstandingAgg, collectedAgg, pendingCount, paidCount, supplierStats] =
      await Promise.all([
        prisma.customer.count({ where: { status: 'active' } }),
        prisma.sale.aggregate({
          where: {
            saleType: { in: ['ledger_daily', 'ledger_monthly'] },
            status: { in: ['pending', 'partial'] },
            remainingBalance: { gt: 0 },
            customer: { status: 'active' }
          },
          _sum: { remainingBalance: true }
        }),
        prisma.payment.aggregate({
          where: {
            amount: { gt: 0 },
            status: 'completed',
            createdAt: { gte: startOfToday, lte: endOfToday },
            sale: {
              saleType: { in: ['ledger_daily', 'ledger_monthly'] },
              customer: { status: 'active' }
            }
          },
          _sum: { amount: true }
        }),
        prisma.customer.count({
          where: {
            status: 'active',
            sales: {
              some: {
                status: { in: ['pending', 'partial'] },
                remainingBalance: { gt: 0 }
              }
            }
          }
        }),
        prisma.customer.count({
          where: {
            status: 'active',
            sales: {
              none: {
                status: { in: ['pending', 'partial'] },
                remainingBalance: { gt: 0 }
              }
            }
          }
        }),
        prisma.$queryRaw<Array<{ accounts: number; outstanding: number | null }>>`
          SELECT COUNT(*) as accounts,
                 COALESCE(SUM(
                   (SELECT COALESCE(SUM(c.amount), 0) FROM SupplierCollection c WHERE c.supplierId = s.id) -
                   (SELECT COALESCE(SUM(p.amount), 0) FROM SupplierPayment p WHERE p.supplierId = s.id) -
                   COALESCE(s.guaranteedAdvance, 0)
                 ), 0) as outstanding
          FROM Supplier s
          WHERE s.isActive = 1
        `
      ]);

    return {
      success: true,
      statusCode: 200,
      data: {
        khataAccounts,
        // Customer dues only — supplier balances are separate (supplierPayables)
        totalOutstanding: money(outstandingAgg._sum.remainingBalance || 0),
        collectedToday: money(collectedAgg._sum.amount || 0),
        pendingCount,
        paidCount,
        supplierAccounts: Number(supplierStats[0]?.accounts || 0),
        // Signed: can be negative when advance credit remains
        supplierPayables: money(Number(supplierStats[0]?.outstanding || 0))
      }
    };
  }

  /**
   * Get single customer
   */
  static async getCustomerById(id: number) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          where: {
            items: {
              some: { itemName: 'Opening Balance' }
            }
          },
          select: {
            totalAmount: true,
            remainingBalance: true,
            paidAmount: true
          }
        }
      }
    });

    if (!customer) {
      return {
        success: false,
        statusCode: 404,
        message: 'Customer not found.'
      };
    }

    const { sales, ...rest } = customer;
    const openingSale = sales[0];
    const openingBalance = openingSale ? money(openingSale.totalAmount) : 0;

    return {
      success: true,
      statusCode: 200,
      data: {
        ...rest,
        openingBalance
      }
    };
  }

  /**
   * Update customer info
   */
  static async updateCustomer(id: number, payload: UpdateCustomerPayload) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return {
        success: false,
        statusCode: 404,
        message: 'Customer not found.'
      };
    }

    if (
      payload.customerType !== undefined &&
      !(CUSTOMER_TYPES as readonly string[]).includes(payload.customerType as any)
    ) {
      return {
        success: false,
        statusCode: 400,
        message: `Invalid customerType. Allowed: ${CUSTOMER_TYPES.join(', ')}`
      };
    }

    if (payload.name !== undefined && !payload.name.trim()) {
      return {
        success: false,
        statusCode: 400,
        message: 'name cannot be empty.'
      };
    }

    if (payload.openingBalance !== undefined) {
      const opening = Number(payload.openingBalance);
      if (Number.isNaN(opening) || opening < 0) {
        return {
          success: false,
          statusCode: 400,
          message: 'openingBalance must be 0 or more.'
        };
      }
    }

    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: {
          ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
          ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
          ...(payload.address !== undefined ? { address: payload.address?.trim() || null } : {}),
          ...(payload.customerType !== undefined ? { customerType: payload.customerType } : {})
        }
      });

      if (payload.openingBalance !== undefined) {
        const opening = money(Number(payload.openingBalance) || 0);
        const effectiveCustomerType = payload.customerType || existing.customerType;
        const saleType =
          effectiveCustomerType === 'monthly_ledger' ? 'ledger_monthly' : 'ledger_daily';
        const periodStart = customerPeriodStart(effectiveCustomerType);
        const openingAt = new Date(periodStart.getTime() - 1000);

        const existingOpeningSale = await tx.sale.findFirst({
          where: {
            customerId: id,
            items: {
              some: { itemName: 'Opening Balance' }
            }
          },
          include: { items: true, payments: true }
        });

        if (existingOpeningSale) {
          if (opening === 0 && (existingOpeningSale.paidAmount || 0) === 0) {
            const cloudUuid = await SyncQueueService.getCloudMapping('Sale', existingOpeningSale.id, tx);
            if (cloudUuid) {
              await SyncQueueService.enqueueUpdate(
                tx,
                'Sale',
                existingOpeningSale.id,
                existingOpeningSale,
                1,
                'DELETE'
              );
            }
            await tx.payment.deleteMany({ where: { saleId: existingOpeningSale.id } });
            await tx.saleItem.deleteMany({ where: { saleId: existingOpeningSale.id } });
            await tx.sale.delete({ where: { id: existingOpeningSale.id } });
          } else {
            const paid = existingOpeningSale.paidAmount || 0;
            const remaining = Math.max(0, money(opening - paid));
            const status = remaining === 0 ? 'completed' : paid > 0 ? 'partial' : 'pending';

            const updatedSale = await tx.sale.update({
              where: { id: existingOpeningSale.id },
              data: {
                totalAmount: opening,
                remainingBalance: remaining,
                status,
                customerName: updated.name,
                customerPhone: updated.phone,
                saleType
              }
            });
            await SyncQueueService.enqueueUpdate(tx, 'Sale', updatedSale.id, updatedSale, 1);

            const openingItem = existingOpeningSale.items.find(
              (i) => i.itemName === 'Opening Balance'
            );
            if (openingItem) {
              const updatedItem = await tx.saleItem.update({
                where: { id: openingItem.id },
                data: {
                  unitPrice: opening,
                  totalPrice: opening
                }
              });
              await SyncQueueService.enqueueUpdate(tx, 'SaleItem', updatedItem.id, updatedItem, 2);
            }
          }
        } else if (opening > 0) {
          const newSale = await tx.sale.create({
            data: {
              saleType,
              customerId: updated.id,
              customerName: updated.name,
              customerPhone: updated.phone,
              totalAmount: opening,
              paidAmount: 0,
              remainingBalance: opening,
              status: 'pending',
              createdAt: openingAt,
              items: {
                create: [
                  {
                    itemName: 'Opening Balance',
                    quantity: 1,
                    unitPrice: opening,
                    totalPrice: opening
                  }
                ]
              },
              payments: {
                create: { method: 'cash', amount: 0, status: 'pending' }
              }
            },
            include: { items: true, payments: true }
          });

          await SyncQueueService.enqueueCreate(tx, 'Sale', newSale.id, newSale, 1);
          for (const item of newSale.items) {
            await SyncQueueService.enqueueCreate(tx, 'SaleItem', item.id, item, 2);
          }
          for (const payment of newSale.payments) {
            await SyncQueueService.enqueueCreate(tx, 'Payment', payment.id, payment, 2);
          }
        }
      }

      await SyncQueueService.enqueueUpdate(tx, 'Customer', updated.id, updated, 0);
      return updated;
    });

    return {
      success: true,
      statusCode: 200,
      message: 'Customer updated successfully.',
      data: customer
    };
  }

  /**
   * Soft-delete a customer (sets status to inactive).
   * Ledger sales history is preserved.
   */
  static async deleteCustomer(id: number) {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return {
        success: false,
        statusCode: 404,
        message: 'Customer not found.'
      };
    }

    if (existing.status === 'inactive') {
      return {
        success: false,
        statusCode: 400,
        message: 'Customer is already deleted (inactive).'
      };
    }

    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: { status: 'inactive' }
      });
      await SyncQueueService.enqueueUpdate(tx, 'Customer', updated.id, updated, 0);
      return updated;
    });

    return {
      success: true,
      statusCode: 200,
      message: 'Customer deleted successfully.',
      data: customer
    };
  }

  /**
   * Activate or deactivate a customer
   */
  static async updateCustomerStatus(id: number, status: string) {
    if (!(CUSTOMER_STATUSES as readonly string[]).includes(status as any)) {
      return {
        success: false,
        statusCode: 400,
        message: `Invalid status. Allowed: ${CUSTOMER_STATUSES.join(', ')}`
      };
    }

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return {
        success: false,
        statusCode: 404,
        message: 'Customer not found.'
      };
    }

    const customer = await prisma.$transaction(async (tx) => {
      const updated = await tx.customer.update({
        where: { id },
        data: { status }
      });
      await SyncQueueService.enqueueUpdate(tx, 'Customer', updated.id, updated, 0);
      return updated;
    });
    return {
      success: true,
      statusCode: 200,
      message: `Customer ${status === 'active' ? 'activated' : 'deactivated'} successfully.`,
      data: customer
    };
  }

  /**
   * Get all pending/partial sales (dues) for a ledger customer
   */
  static async getCustomerDues(id: number) {
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return {
        success: false,
        statusCode: 404,
        message: 'Customer not found.'
      };
    }

    const dues = await prisma.sale.findMany({
      where: {
        customerId: id,
        status: { in: ['pending', 'partial'] }
      },
      orderBy: { id: 'asc' },
      include: { items: true, payments: true }
    });

    const totalDue = money(dues.reduce((sum, s) => sum + s.remainingBalance, 0));

    return {
      success: true,
      statusCode: 200,
      data: {
        customer,
        dues,
        totalDue,
        count: dues.length
      }
    };
  }

  /**
   * Settle pending/partial sales. Optional discount permanently writes off dues
   * (reduces totalAmount + remainingBalance) so they do not reappear as Previous/Remaining.
   */
  static async settleAllDues(
    customerId: number,
    paymentMethod: string,
    amount?: number,
    discount?: number
  ) {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return {
        success: false,
        statusCode: 404,
        message: 'Customer not found.'
      };
    }

    const pendingSales = await prisma.sale.findMany({
      where: {
        customerId,
        status: { in: ['pending', 'partial'] }
      },
      orderBy: { id: 'asc' }
    });

    // Edge: ledger customer with zero dues — soft success, not an error
    if (pendingSales.length === 0) {
      return {
        success: true,
        statusCode: 200,
        message: 'No pending dues found for this customer.',
        data: {
          customer,
          settledCount: 0,
          totalSettled: 0,
          totalDiscount: 0,
          sales: []
        }
      };
    }

    const totalOutstanding = money(
      pendingSales.reduce((sum, s) => sum + s.remainingBalance, 0)
    );

    const discountAmount =
      discount === undefined || discount === null ? 0 : money(Number(discount));

    if (Number.isNaN(discountAmount) || discountAmount < 0) {
      return {
        success: false,
        statusCode: 400,
        message: 'Discount must be a valid number greater than or equal to zero.'
      };
    }

    // Blank collect amount = clear everything left after discount via cash
    const requestedAmount =
      amount === undefined || amount === null
        ? money(totalOutstanding - discountAmount)
        : money(Number(amount));

    if (Number.isNaN(requestedAmount)) {
      return {
        success: false,
        statusCode: 400,
        message: 'Amount must be a valid number.'
      };
    }

    if (requestedAmount < 0) {
      return {
        success: false,
        statusCode: 400,
        message: 'Collection amount cannot be negative.'
      };
    }

    if (requestedAmount <= 0 && discountAmount <= 0) {
      return {
        success: false,
        statusCode: 400,
        message: 'Enter a collection amount and/or a discount greater than zero.'
      };
    }

    if (money(requestedAmount + discountAmount) > totalOutstanding) {
      return {
        success: false,
        statusCode: 400,
        message: `Cash + discount (Rs. ${money(requestedAmount + discountAmount)}) cannot exceed outstanding Rs. ${totalOutstanding}.`
      };
    }

    if (requestedAmount > 0) {
      if (!paymentMethod || !(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
        return {
          success: false,
          statusCode: 400,
          message: `paymentMethod is required. Allowed: ${PAYMENT_METHODS.join(', ')}`
        };
      }
    }

    const settledSales = await prisma.$transaction(async (tx) => {
      const resultsById = new Map<number, any>();
      let remainingToApply = requestedAmount;
      let remainingDiscount = discountAmount;

      // Working copy of balances after cash / write-off steps
      const working = pendingSales.map((s) => ({
        id: s.id,
        paidAmount: money(s.paidAmount),
        remainingBalance: money(s.remainingBalance),
        totalAmount: money(s.totalAmount),
      }));

      for (const sale of working) {
        if (sale.remainingBalance <= 0 || remainingToApply <= 0) continue;

        const applied = money(Math.min(sale.remainingBalance, remainingToApply));
        if (applied <= 0) continue;

        const partialPayments = await tx.payment.findMany({
          where: {
            saleId: sale.id,
            status: { in: ['pending', 'partial'] }
          }
        });

        for (const p of partialPayments) {
          const updatedP = await tx.payment.update({
            where: { id: p.id },
            data: { status: 'completed' }
          });
          await SyncQueueService.enqueueUpdate(tx, 'Payment', updatedP.id, updatedP, 2);
        }

        const newPay = await tx.payment.create({
          data: {
            saleId: sale.id,
            method: paymentMethod as PaymentMethod,
            amount: applied,
            status: 'completed'
          }
        });
        await SyncQueueService.enqueueCreate(tx, 'Payment', newPay.id, newPay, 2);

        sale.paidAmount = money(sale.paidAmount + applied);
        sale.remainingBalance = money(sale.remainingBalance - applied);
        remainingToApply = money(remainingToApply - applied);
      }

      // Write-off: cut bill total + remaining so dues never reappear as Previous
      for (const sale of working) {
        if (sale.remainingBalance <= 0 || remainingDiscount <= 0) continue;

        const writeOff = money(Math.min(sale.remainingBalance, remainingDiscount));
        if (writeOff <= 0) continue;

        const discountPay = await tx.payment.create({
          data: {
            saleId: sale.id,
            method: 'discount',
            amount: writeOff,
            status: 'completed'
          }
        });
        await SyncQueueService.enqueueCreate(tx, 'Payment', discountPay.id, discountPay, 2);

        sale.totalAmount = money(sale.totalAmount - writeOff);
        sale.remainingBalance = money(sale.remainingBalance - writeOff);
        remainingDiscount = money(remainingDiscount - writeOff);
      }

      for (const sale of working) {
        const original = pendingSales.find((s) => s.id === sale.id)!;
        const changed =
          sale.paidAmount !== money(original.paidAmount) ||
          sale.remainingBalance !== money(original.remainingBalance) ||
          sale.totalAmount !== money(original.totalAmount);

        if (!changed) continue;

        const updated = await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: sale.paidAmount,
            remainingBalance: sale.remainingBalance,
            totalAmount: sale.totalAmount,
            status: sale.remainingBalance <= 0 ? 'paid' : 'partial'
          },
          include: { items: true, payments: true }
        });
        await SyncQueueService.enqueueUpdate(tx, 'Sale', updated.id, updated, 1);
        resultsById.set(sale.id, updated);
      }

      return Array.from(resultsById.values());
    });

    const cleared = money(requestedAmount + discountAmount);
    return {
      success: true,
      statusCode: 200,
      message:
        cleared === totalOutstanding
          ? `Settled ${settledSales.length} sale(s) successfully.`
          : `Collected Rs. ${requestedAmount}${discountAmount > 0 ? ` and wrote off Rs. ${discountAmount}` : ''}; remaining khata updated.`,
      data: {
        customer,
        settledCount: settledSales.length,
        totalSettled: requestedAmount,
        totalDiscount: discountAmount,
        sales: settledSales
      }
    };
  }
}
