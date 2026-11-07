import { prisma } from '../config/database';
import { SyncQueueService } from './syncQueue.service';
import { NotificationService } from './notification.service';
const CUSTOMER_TYPES = ['daily_ledger', 'monthly_ledger'] as const;
const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
const PAYMENT_METHODS = ['cash', 'online'] as const;

type PaymentMethod = (typeof PAYMENT_METHODS)[number];

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseRangeStart(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return new Date(value);
}

function parseRangeEnd(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value);
    d.setHours(23, 59, 59, 999);
    return d;
  }
  return new Date(value);
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
  /** Optional custom milk rate per kg */
  customMilkRate?: number | null;
}

export interface UpdateCustomerPayload {
  name?: string;
  phone?: string;
  address?: string;
  customerType?: string;
  openingBalance?: number;
  /** Optional custom milk rate per kg */
  customMilkRate?: number | null;
}

export class CustomerService {
  /**
   * Create a registered ledger customer.
   * Optional openingBalance creates a pending sale dated before the current
   * period so it appears in Previous and can be collected like normal dues.
   */
  static async createCustomer(payload: CreateCustomerPayload) {
    const { name, phone, address, customerType, openingBalance, customMilkRate } = payload;

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
          status: 'active',
          customMilkRate: customMilkRate != null && Number(customMilkRate) > 0 ? Number(customMilkRate) : null
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

    NotificationService.create({
      category: 'customer',
      title: 'New Customer Added',
      message: `Customer "${customer.name}" registered as ${customer.customerType === 'daily_ledger' ? 'Daily Ledger' : 'Monthly Ledger'}.`,
      metadata: { customerId: customer.id, name: customer.name, customerType: customer.customerType },
    }).catch(() => {});

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
    const where: any = { customerType: { in: [...CUSTOMER_TYPES] } };
    const andFilters: any[] = [];

    if (filters?.status === 'all') {
      // Do not restrict by status, fetch both active and inactive
    } else {
      where.status = filters?.status?.trim() || 'active';
    }

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
      rangeStart = parseRangeStart(filters.fromDate);
      if (Number.isNaN(rangeStart.getTime())) {
        return { success: false, statusCode: 400, message: 'Invalid fromDate.' };
      }
    }
    if (filters?.toDate) {
      rangeEnd = parseRangeEnd(filters.toDate);
      if (Number.isNaN(rangeEnd.getTime())) {
        return { success: false, statusCode: 400, message: 'Invalid toDate.' };
      }
    }

    if (rangeStart || rangeEnd) {
      const createdAt: any = {};
      if (rangeStart) createdAt.gte = rangeStart;
      if (rangeEnd) createdAt.lte = rangeEnd;
      // Include customer if they have sales in range OR payments collected in range
      andFilters.push({
        OR: [
          { sales: { some: { createdAt } } },
          { sales: { some: { payments: { some: { amount: { gt: 0 }, status: 'completed', createdAt } } } } }
        ]
      });
    }

    if (andFilters.length === 1) {
      Object.assign(where, andFilters[0]);
    } else if (andFilters.length > 1) {
      where.AND = andFilters;
    }

    const now = new Date();

    // ── Optimised: fetch customers + run 3 parallel SQL aggregates ──────────
    // Instead of loading every sale for every customer into JS memory,
    // we compute sums directly in SQLite and join on customerIds.
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { id: 'desc' },
      // Only fetch the opening-balance sale to get that amount — all other
      // balance calculations are done via aggregate queries below.
      include: {
        sales: {
          where: { items: { some: { itemName: 'Opening Balance' } } },
          take: 1,
          select: { id: true, totalAmount: true, createdAt: true }
        }
      }
    });

    if (customers.length === 0) {
      return { success: true, statusCode: 200, data: [] };
    }

    const customerIds = customers.map((c) => c.id);

    // Compute period start per type
    const periodStartDaily = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const periodStartMonthly = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    // Run all 4 aggregate queries in parallel for maximum speed
    const [
      remainingAgg,    // open dues per customer (pending/partial with remaining > 0)
      paidAgg,         // total paid per customer across all time
      currentDailyAgg, // totalAmount for daily ledger customers in current period
      currentMonthlyAgg, // totalAmount for monthly ledger customers in current period
      lastSaleAgg      // most recent sale date per customer
    ] = await Promise.all([
      // 1. Open remaining balance
      prisma.sale.groupBy({
        by: ['customerId'],
        where: {
          customerId: { in: customerIds },
          status: { in: ['pending', 'partial'] },
          remainingBalance: { gt: 0 }
        },
        _sum: { remainingBalance: true }
      }),

      // 2. Total paid amount from completed payments within the active date range
      // (when no date filter is set, returns all-time totals)
      prisma.payment.groupBy({
        by: ['saleId'],
        where: {
          amount: { gt: 0 },
          status: 'completed',
          sale: { customerId: { in: customerIds } },
          ...(rangeStart || rangeEnd
            ? {
                createdAt: {
                  ...(rangeStart ? { gte: rangeStart } : {}),
                  ...(rangeEnd ? { lte: rangeEnd } : {}),
                },
              }
            : {}),
        },
        _sum: { amount: true },
      }),

      // 3a. Current period: daily_ledger customers (today onwards)
      prisma.sale.groupBy({
        by: ['customerId'],
        where: {
          customerId: { in: customerIds },
          saleType: 'ledger_daily',
          createdAt: {
            gte: rangeStart || periodStartDaily,
            ...(rangeEnd ? { lte: rangeEnd } : {})
          }
        },
        _sum: { totalAmount: true }
      }),

      // 3b. Current period: monthly_ledger customers (this month onwards)
      prisma.sale.groupBy({
        by: ['customerId'],
        where: {
          customerId: { in: customerIds },
          saleType: 'ledger_monthly',
          createdAt: {
            gte: rangeStart || periodStartMonthly,
            ...(rangeEnd ? { lte: rangeEnd } : {})
          }
        },
        _sum: { totalAmount: true }
      }),

      // 4. Last sale date
      prisma.sale.groupBy({
        by: ['customerId'],
        where: { customerId: { in: customerIds } },
        _max: { createdAt: true }
      })
    ]);

    // Build lookup maps for O(1) access
    const remainingMap = new Map(remainingAgg.map((r) => [r.customerId!, r._sum.remainingBalance || 0]));

    // Resolve payment saleIds to customerIds for accurate paid totals
    const paidSaleIds = paidAgg.map((r) => r.saleId).filter(Boolean) as number[];
    const paidSales = paidSaleIds.length > 0
      ? await prisma.sale.findMany({
          where: { id: { in: paidSaleIds } },
          select: { id: true, customerId: true },
        })
      : [];
    const saleCustMap = new Map(paidSales.map((s) => [s.id, s.customerId]));
    const paidMap = new Map<number, number>();
    for (const r of paidAgg) {
      const cId = saleCustMap.get(r.saleId!);
      if (cId) {
        paidMap.set(cId, (paidMap.get(cId) || 0) + (r._sum.amount || 0));
      }
    }

    const currentDailyMap = new Map(currentDailyAgg.map((r) => [r.customerId!, r._sum.totalAmount || 0]));
    const currentMonthlyMap = new Map(currentMonthlyAgg.map((r) => [r.customerId!, r._sum.totalAmount || 0]));
    const lastSaleMap = new Map(lastSaleAgg.map((r) => [r.customerId!, r._max.createdAt]));

    const data = customers.map((c) => {
      const openingSale = c.sales[0];
      const openingBalance = openingSale ? money(openingSale.totalAmount) : 0;

      const remainingBalance = money(remainingMap.get(c.id) || 0);
      const paidAmount = money(paidMap.get(c.id) || 0);
      const currentDue = money(
        c.customerType === 'daily_ledger'
          ? (currentDailyMap.get(c.id) || 0)
          : (currentMonthlyMap.get(c.id) || 0)
      );

      // previousDue = total billed - currentDue billing
      const totalBilled = money(paidAmount + remainingBalance);
      const previousDue = money(Math.max(0, totalBilled - currentDue));
      const totalAmount = money(currentDue + previousDue);

      const lastSaleDate = lastSaleMap.get(c.id);

      const { sales: _sales, ...rest } = c;
      return {
        ...rest,
        openingBalance,
        currentDue,
        previousDue,
        totalAmount,
        paidAmount,
        remainingBalance,
        totalDue: remainingBalance,
        lastSaleDate: lastSaleDate ? lastSaleDate.toISOString() : null
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
  static async getCustomersSummary(scope?: string, fromDate?: string, toDate?: string) {
    if (scope === 'ledger') {
      return CustomerService.getLedgerSummary(fromDate, toDate);
    }

    const [activeLedgerCount, walkInCount, splitCount] = await Promise.all([
      prisma.customer.count({ where: { status: 'active', customerType: { in: [...CUSTOMER_TYPES] } } }),
      prisma.customer.count({ where: { customerType: 'walk_in', status: 'active' } }),
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
  static async getLedgerSummary(fromDate?: string, toDate?: string) {
    // ── Date range ────────────────────────────────────────────────────────────
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;
    let fromYMD: string | undefined = undefined;
    let toYMD: string | undefined = undefined;

    if (fromDate) {
      rangeStart = parseRangeStart(fromDate);
      fromYMD = fromDate.slice(0, 10);
      if (Number.isNaN(rangeStart.getTime())) { rangeStart = null; fromYMD = undefined; }
    }
    if (toDate) {
      rangeEnd = parseRangeEnd(toDate);
      toYMD = toDate.slice(0, 10);
      if (Number.isNaN(rangeEnd.getTime())) { rangeEnd = null; toYMD = undefined; }
    }

    const isFiltered = !!(rangeStart || rangeEnd);
    // When no date filter (All Time), query all payments. When filtered, constrain by range.
    const collectedDateFilter: any = isFiltered
      ? {
          ...(rangeStart ? { gte: rangeStart } : {}),
          ...(rangeEnd ? { lte: rangeEnd } : {}),
        }
      : undefined;

    // Supplier payment date filter (stored as 'YYYY-MM-DD' strings)
    const supplierPaymentWhere: any = {};
    if (isFiltered) {
      supplierPaymentWhere.date = {
        ...(fromYMD ? { gte: fromYMD } : {}),
        ...(toYMD ? { lte: toYMD } : {}),
      };
    }

    // ── Outstanding: filter by sale creation date when range is active ─────────
    const outstandingWhere: any = {
      saleType: { in: ['ledger_daily', 'ledger_monthly'] },
      status: { in: ['pending', 'partial'] },
      remainingBalance: { gt: 0 },
      customer: { status: 'active' },
    };
    if (isFiltered) {
      outstandingWhere.createdAt = {
        ...(rangeStart ? { gte: rangeStart } : {}),
        ...(rangeEnd ? { lte: rangeEnd } : {}),
      };
    }

    // ── Pending / Paid customer counts ──────────────────────────────────────────
    const saleDateFilter: any = isFiltered
      ? {
          createdAt: {
            ...(rangeStart ? { gte: rangeStart } : {}),
            ...(rangeEnd ? { lte: rangeEnd } : {}),
          },
        }
      : {};

    const pendingCountWhere: any = {
      status: 'active',
      customerType: { in: [...CUSTOMER_TYPES] },
      sales: {
        some: {
          status: { in: ['pending', 'partial'] },
          remainingBalance: { gt: 0 },
          ...saleDateFilter,
        },
      },
    };
    const paidCountWhere: any = {
      status: 'active',
      customerType: { in: [...CUSTOMER_TYPES] },
      sales: {
        none: {
          status: { in: ['pending', 'partial'] },
          remainingBalance: { gt: 0 },
          ...saleDateFilter,
        },
      },
    };

    // ── Khata account count ──────────────────────────────────────────────────────
    // Filtered: customers with at least one sale in range. All-time: all active.
    const accountCountWhere: any = isFiltered
      ? {
          status: 'active',
          customerType: { in: [...CUSTOMER_TYPES] },
          OR: [
            {
              sales: {
                some: {
                  createdAt: {
                    ...(rangeStart ? { gte: rangeStart } : {}),
                    ...(rangeEnd ? { lte: rangeEnd } : {}),
                  },
                },
              },
            },
            {
              sales: {
                some: {
                  payments: {
                    some: {
                      amount: { gt: 0 },
                      status: 'completed',
                      ...(collectedDateFilter ? { createdAt: collectedDateFilter } : {}),
                    },
                  },
                },
              },
            },
          ],
        }
      : { status: 'active', customerType: { in: [...CUSTOMER_TYPES] } };

    // ── Supplier payables ────────────────────────────────────────────────────────
    // Filtered: net flow (collections − payments) within range.
    // All-time: overall balance (collections − payments − advance).
    let supplierStatsPromise: Promise<Array<{ accounts: number; outstanding: number | null }>>;
    if (isFiltered) {
      const fromStr = rangeStart ? rangeStart.toISOString().slice(0, 10) : '1970-01-01';
      const toStr = rangeEnd ? rangeEnd.toISOString().slice(0, 10) : '9999-12-31';
      supplierStatsPromise = prisma.$queryRaw<Array<{ accounts: number; outstanding: number | null }>>`
        SELECT COUNT(DISTINCT s.id) as accounts,
               COALESCE(SUM(
                 (SELECT COALESCE(SUM(c.amount), 0) FROM SupplierCollection c
                  WHERE c.supplierId = s.id AND date(c.createdAt) BETWEEN ${fromStr} AND ${toStr}) -
                 (SELECT COALESCE(SUM(p.amount), 0) FROM SupplierPayment p
                  WHERE p.supplierId = s.id AND date(p.createdAt) BETWEEN ${fromStr} AND ${toStr})
               ), 0) as outstanding
        FROM Supplier s
        WHERE s.isActive = 1
      `;
    } else {
      supplierStatsPromise = prisma.$queryRaw<Array<{ accounts: number; outstanding: number | null }>>`
        SELECT COUNT(*) as accounts,
               COALESCE(SUM(
                 (SELECT COALESCE(SUM(c.amount), 0) FROM SupplierCollection c WHERE c.supplierId = s.id) -
                 (SELECT COALESCE(SUM(p.amount), 0) FROM SupplierPayment p WHERE p.supplierId = s.id) -
                 COALESCE(s.guaranteedAdvance, 0)
               ), 0) as outstanding
        FROM Supplier s
        WHERE s.isActive = 1
      `;
    }

    const [khataAccounts, outstandingAgg, collectedAgg, pendingCount, paidCount, supplierStats, supplierPaidAgg] =
      await Promise.all([
        prisma.customer.count({ where: accountCountWhere }),
        prisma.sale.aggregate({ where: outstandingWhere, _sum: { remainingBalance: true } }),
        prisma.payment.aggregate({
          where: {
            amount: { gt: 0 },
            status: 'completed',
            ...(collectedDateFilter ? { createdAt: collectedDateFilter } : {}),
            sale: {
              saleType: { in: ['ledger_daily', 'ledger_monthly'] },
              customer: { status: 'active' }
            }
          },
          _sum: { amount: true }
        }),
        prisma.customer.count({ where: pendingCountWhere }),
        prisma.customer.count({ where: paidCountWhere }),
        supplierStatsPromise,
        prisma.supplierPayment.aggregate({
          where: supplierPaymentWhere,
          _sum: { amount: true }
        }),
      ]);

    return {
      success: true,
      statusCode: 200,
      data: {
        khataAccounts,
        totalOutstanding: money(outstandingAgg._sum.remainingBalance || 0),
        collectedToday: money(collectedAgg._sum.amount || 0),
        pendingCount,
        paidCount,
        supplierAccounts: Number(supplierStats[0]?.accounts || 0),
        supplierPayables: money(Number(supplierStats[0]?.outstanding || 0)),
        supplierPaid: money(supplierPaidAgg._sum.amount || 0),
      }
    };
  }

  /**
   * Collected breakdown — per-customer payment totals for a date range.
   * Used by the "Collected Today / Period" breakdown modal in Khata Ledger.
   */
  static async getCollectedBreakdown(fromDate?: string, toDate?: string) {
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;

    if (fromDate) {
      rangeStart = parseRangeStart(fromDate);
      if (Number.isNaN(rangeStart.getTime())) rangeStart = null;
    }
    if (toDate) {
      rangeEnd = parseRangeEnd(toDate);
      if (Number.isNaN(rangeEnd.getTime())) rangeEnd = null;
    }

    const isFiltered = !!(rangeStart || rangeEnd);
    const createdAtFilter: any = isFiltered
      ? {
          ...(rangeStart ? { gte: rangeStart } : {}),
          ...(rangeEnd ? { lte: rangeEnd } : {}),
        }
      : undefined;

    const rows = await prisma.payment.groupBy({
      by: ['saleId'],
      where: {
        amount: { gt: 0 },
        status: 'completed',
        ...(createdAtFilter ? { createdAt: createdAtFilter } : {}),
        sale: {
          saleType: { in: ['ledger_daily', 'ledger_monthly'] },
          customer: { status: 'active' },
        },
      },
      _sum: { amount: true },
      _max: { createdAt: true },
    });

    if (rows.length === 0) {
      return { success: true, statusCode: 200, data: [] };
    }

    const saleIds = rows.map((r) => r.saleId).filter(Boolean) as number[];
    const sales = await prisma.sale.findMany({
      where: { id: { in: saleIds } },
      select: {
        id: true,
        customer: {
          select: { id: true, name: true, phone: true, address: true, customerType: true },
        },
      },
    });

    const saleMap = new Map(sales.map((s) => [s.id, s.customer]));

    type BreakdownEntry = {
      customerId: number;
      customerName: string;
      phone: string | null;
      address: string | null;
      customerType: string;
      totalPaid: number;
      lastPaymentDate: Date | null;
      paymentCount: number;
    };

    const customerMap = new Map<number, BreakdownEntry>();

    for (const row of rows) {
      const customer = saleMap.get(row.saleId!);
      if (!customer) continue;
      const paid = Number(row._sum.amount || 0);
      const payDate = row._max.createdAt ?? null;
      const existing = customerMap.get(customer.id);
      if (existing) {
        existing.totalPaid += paid;
        existing.paymentCount += 1;
        if (payDate && (!existing.lastPaymentDate || payDate > existing.lastPaymentDate)) {
          existing.lastPaymentDate = payDate;
        }
      } else {
        customerMap.set(customer.id, {
          customerId: customer.id,
          customerName: customer.name,
          phone: customer.phone ?? null,
          address: customer.address ?? null,
          customerType: customer.customerType ?? '',
          totalPaid: paid,
          lastPaymentDate: payDate,
          paymentCount: 1,
        });
      }
    }

    const data = Array.from(customerMap.values())
      .sort((a, b) => b.totalPaid - a.totalPaid)
      .map((r) => ({
        ...r,
        totalPaid: Math.round(r.totalPaid * 100) / 100,
        lastPaymentDate: r.lastPaymentDate?.toISOString() ?? null,
      }));

    return { success: true, statusCode: 200, data };
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
          ...(payload.customerType !== undefined ? { customerType: payload.customerType } : {}),
          ...(payload.customMilkRate !== undefined ? { customMilkRate: payload.customMilkRate != null && Number(payload.customMilkRate) > 0 ? Number(payload.customMilkRate) : null } : {})
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

    if (requestedAmount > 0 || discountAmount > 0) {
      NotificationService.create({
        category: 'khata',
        title: 'Khata Payment Collected',
        message: `Collected Rs. ${requestedAmount.toLocaleString()} from ${customer.name}${discountAmount > 0 ? ` (Rs. ${discountAmount.toLocaleString()} discount)` : ''} via ${paymentMethod}.`,
        metadata: { customerId: customer.id, customerName: customer.name, amount: requestedAmount, discount: discountAmount, paymentMethod },
      }).catch(() => {});
    }

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
