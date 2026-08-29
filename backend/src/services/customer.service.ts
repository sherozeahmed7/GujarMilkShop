import { prisma } from '../config/database';

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
}

export interface UpdateCustomerPayload {
  name?: string;
  phone?: string;
  address?: string;
  customerType?: string;
}

export class CustomerService {
  /**
   * Create a registered ledger customer
   */
  static async createCustomer(payload: CreateCustomerPayload) {
    const { name, phone, address, customerType } = payload;

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

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        customerType,
        status: 'active'
      }
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
   * Each row includes currentDue, previousDue, totalDue, and lastSaleDate.
   * currentDue = open remaining in this period (today for daily, this month for monthly).
   * previousDue = open remaining from before this period.
   * totalDue = currentDue + previousDue.
   */
  static async listCustomers(filters?: {
    status?: string;
    customerType?: string;
    search?: string;
    dues?: boolean;
    duesStatus?: string;
  }) {
    const where: any = {};

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
      where.sales = openDuesFilter;
    } else if (duesStatus === 'paid') {
      where.sales = noOpenDuesFilter;
    } else if (duesStatus && duesStatus !== 'all') {
      return {
        success: false,
        statusCode: 400,
        message: 'Invalid duesStatus. Allowed: pending, paid, all.'
      };
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        sales: {
          orderBy: { createdAt: 'desc' },
          select: {
            remainingBalance: true,
            totalAmount: true,
            paidAmount: true,
            createdAt: true,
            status: true
          }
        }
      }
    });

    const now = new Date();
    const data = customers.map((c) => {
      const periodStart = customerPeriodStart(c.customerType, now);
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
        if (sale.createdAt >= periodStart) currentAmount += sale.totalAmount || 0;
        else previousAmount += sale.totalAmount || 0;
      }

      currentAmount = money(currentAmount);
      previousAmount = money(previousAmount);
      paidAmount = money(paidAmount);
      remainingBalance = money(remainingBalance);
      const totalAmount = money(currentAmount + previousAmount);
      const lastSale = c.sales[0];

      const { sales: _sales, ...rest } = c;
      return {
        ...rest,
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
      where: { id }
    });

    if (!customer) {
      return {
        success: false,
        statusCode: 404,
        message: 'Customer not found.'
      };
    }

    return {
      success: true,
      statusCode: 200,
      data: customer
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

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
        ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
        ...(payload.address !== undefined ? { address: payload.address?.trim() || null } : {}),
        ...(payload.customerType !== undefined ? { customerType: payload.customerType } : {})
      }
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

    const customer = await prisma.customer.update({
      where: { id },
      data: { status: 'inactive' }
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

    const customer = await prisma.customer.update({
      where: { id },
      data: { status }
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
   * Settle ALL pending/partial sales for a ledger customer in one go.
   * Edge cases:
   * - No pending dues → 200 OK with message (not an error)
   * - Double settlement → individual sales already paid are skipped by query
   * - Requires paymentMethod for the lump-sum settlement
   */
  static async settleAllDues(customerId: number, paymentMethod: string, amount?: number) {
    if (!paymentMethod || !(PAYMENT_METHODS as readonly string[]).includes(paymentMethod)) {
      return {
        success: false,
        statusCode: 400,
        message: `paymentMethod is required. Allowed: ${PAYMENT_METHODS.join(', ')}`
      };
    }

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
          sales: []
        }
      };
    }

    const totalOutstanding = money(
      pendingSales.reduce((sum, s) => sum + s.remainingBalance, 0)
    );

    const requestedAmount = amount === undefined || amount === null ? totalOutstanding : money(Number(amount));

    if (Number.isNaN(requestedAmount)) {
      return {
        success: false,
        statusCode: 400,
        message: 'Amount must be a valid number.'
      };
    }

    if (requestedAmount <= 0) {
      return {
        success: false,
        statusCode: 400,
        message: 'Collection amount must be greater than zero.'
      };
    }

    if (requestedAmount > totalOutstanding) {
      return {
        success: false,
        statusCode: 400,
        message: `Amount cannot exceed the customer outstanding balance of Rs. ${totalOutstanding}.`
      };
    }

    const settledSales = await prisma.$transaction(async (tx) => {
      const results = [];
      let remainingToApply = requestedAmount;

      for (const sale of pendingSales) {
        if (sale.status === 'paid' || sale.remainingBalance <= 0 || remainingToApply <= 0) {
          continue;
        }

        const currentRemaining = money(sale.remainingBalance);
        const applied = money(Math.min(currentRemaining, remainingToApply));

        if (applied <= 0) continue;

        await tx.payment.updateMany({
          where: {
            saleId: sale.id,
            status: { in: ['pending', 'partial'] }
          },
          data: { status: 'completed' }
        });

        await tx.payment.create({
          data: {
            saleId: sale.id,
            method: paymentMethod as PaymentMethod,
            amount: applied,
            status: 'completed'
          }
        });

        const newRemaining = money(currentRemaining - applied);
        const updated = await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: money(sale.paidAmount + applied),
            remainingBalance: newRemaining,
            status: newRemaining <= 0 ? 'paid' : 'partial'
          },
          include: { items: true, payments: true }
        });

        results.push(updated);
        remainingToApply = money(remainingToApply - applied);
      }

      return results;
    });

    return {
      success: true,
      statusCode: 200,
      message: requestedAmount === totalOutstanding
        ? `Settled ${settledSales.length} sale(s) successfully.`
        : `Collected Rs. ${requestedAmount} and updated the remaining khata balance.`,
      data: {
        customer,
        settledCount: settledSales.length,
        totalSettled: requestedAmount,
        sales: settledSales
      }
    };
  }
}
