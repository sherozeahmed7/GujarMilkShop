import { prisma } from '../config/database';

const CUSTOMER_TYPES = ['daily_ledger', 'monthly_ledger'] as const;
const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
const PAYMENT_METHODS = ['cash', 'online'] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function money(n: number): number {
  return Math.round(n * 100) / 100;
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
   * - dues: true → only customers with pending/partial remaining balance
   * - customerType: daily_ledger | monthly_ledger
   * - status: active | inactive (default: active)
   * Each row includes totalDue (sum of remainingBalance on open sales).
   */
  static async listCustomers(filters?: {
    status?: string;
    customerType?: string;
    search?: string;
    dues?: boolean;
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

    if (filters?.dues) {
      where.sales = {
        some: {
          status: { in: ['pending', 'partial'] },
          remainingBalance: { gt: 0 }
        }
      };
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { id: 'desc' },
      include: {
        sales: {
          where: {
            status: { in: ['pending', 'partial'] },
            remainingBalance: { gt: 0 }
          },
          select: { remainingBalance: true, createdAt: true }
        }
      }
    });

    const data = customers.map((c) => {
      const totalDue = money(
        c.sales.reduce((sum, s) => sum + s.remainingBalance, 0)
      );

      const { sales: _sales, ...rest } = c;
      return {
        ...rest,
        totalDue,
        lastSaleDate: null as string | null
      };
    });

    return {
      success: true,
      statusCode: 200,
      data
    };
  }

  /**
   * Dashboard summary for Customers screen (global, unfiltered).
   * - totalRows: active ledger customers + all walk-in + all split sales
   * - totalOutstanding: open ledger dues + open split remaining balances
   * - withDues: ledger accounts with dues + split sales still partial
   */
  static async getCustomersSummary() {
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
  static async settleAllDues(customerId: number, paymentMethod: string) {
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

    const totalSettled = money(
      pendingSales.reduce((sum, s) => sum + s.remainingBalance, 0)
    );

    const settledSales = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const sale of pendingSales) {
        // Extra safety: skip if somehow already paid (double-settlement race)
        if (sale.status === 'paid' || sale.remainingBalance <= 0) {
          continue;
        }

        const remaining = money(sale.remainingBalance);

        // Mark existing pending/partial payments as completed
        await tx.payment.updateMany({
          where: {
            saleId: sale.id,
            status: { in: ['pending', 'partial'] }
          },
          data: { status: 'completed' }
        });

        // Record settlement payment for remaining due
        if (remaining > 0) {
          await tx.payment.create({
            data: {
              saleId: sale.id,
              method: paymentMethod as PaymentMethod,
              amount: remaining,
              status: 'completed'
            }
          });
        }

        const updated = await tx.sale.update({
          where: { id: sale.id },
          data: {
            paidAmount: money(sale.totalAmount),
            remainingBalance: 0,
            status: 'paid'
          },
          include: { items: true, payments: true }
        });

        results.push(updated);
      }

      return results;
    });

    return {
      success: true,
      statusCode: 200,
      message: `Settled ${settledSales.length} sale(s) successfully.`,
      data: {
        customer,
        settledCount: settledSales.length,
        totalSettled,
        sales: settledSales
      }
    };
  }
}
