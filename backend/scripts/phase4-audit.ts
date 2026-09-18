import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import fs from 'fs';

const prisma = new PrismaClient();
const neonPool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

const TABLE_MAP: Record<string, string> = {
  User: 'users',
  Supplier: 'suppliers',
  InventoryProduct: 'inventory_products',
  DailyRate: 'daily_rates',
  Customer: 'customers',
  Shift: 'shifts',
  SupplierCollection: 'supplier_collections',
  SupplierPayment: 'supplier_payments',
  Sale: 'sales',
  SaleItem: 'sale_items',
  Payment: 'payments',
  Expense: 'expenses',
  ExpensePayment: 'expense_payments',
  InventoryMovement: 'inventory_movements',
  MilkProductTransaction: 'milk_product_transactions',
  ButterGheeConversion: 'butter_ghee_conversions',
  MilkProductDailyStock: 'milk_product_daily_stocks',
  Return: 'returns',
  ReturnItem: 'return_items',
  AuditRecord: 'audit_records',
  CashPerson: 'cash_persons',
  CashbookTransaction: 'cashbook_transactions',
};

async function runAudit() {
  const report: any = {
    counts: {},
    syncQueue: { PENDING: 0, SYNCING: 0, FAILED: 0, errors: {} },
    mismatches: [],
    tokenReconciliation: { totalChecked: 0, mismatches: [] },
    khata: [],
    supplierLedger: [],
    cashbook: [],
    mappingIntegrity: []
  };

  const neonClient = await neonPool.connect();
  
  try {
    // 1 & 2. Counts
    for (const [prismaModel, neonTable] of Object.entries(TABLE_MAP)) {
      const sqliteCount = await (prisma as any)[prismaModel.charAt(0).toLowerCase() + prismaModel.slice(1)].count();
      const neonRes = await neonClient.query(`SELECT COUNT(*) FROM ${neonTable}`);
      const neonCount = parseInt(neonRes.rows[0].count, 10);
      
      report.counts[prismaModel] = { sqlite: sqliteCount, neon: neonCount };
      if (sqliteCount !== neonCount) {
        report.mismatches.push({ model: prismaModel, sqlite: sqliteCount, neon: neonCount });
      }
    }

    // SyncQueue Status
    const queueGroups = await prisma.syncQueue.groupBy({
      by: ['status', 'entityType', 'error'],
      _count: { _all: true }
    });
    for (const g of queueGroups) {
      if (!report.syncQueue[g.status]) report.syncQueue[g.status] = 0;
      report.syncQueue[g.status] += g._count._all;
      if (g.status === 'FAILED') {
        const key = `${g.entityType}: ${g.error}`;
        report.syncQueue.errors[key] = (report.syncQueue.errors[key] || 0) + g._count._all;
      }
    }

    // 7. Token Number Reconciliation
    const tokenSales = await prisma.sale.findMany({ where: { tokenNumber: { gt: 0 } } });
    report.tokenReconciliation.totalChecked = tokenSales.length;
    for (const sale of tokenSales) {
      const mapping = await prisma.localToCloudMapping.findFirst({
        where: { entityType: 'Sale', localId: sale.id }
      });
      if (mapping) {
        const res = await neonClient.query(`SELECT token_number FROM sales WHERE id = $1`, [mapping.cloudUuid]);
        if (res.rows.length > 0) {
          const neonToken = res.rows[0].token_number;
          if (neonToken !== sale.tokenNumber) {
            report.tokenReconciliation.mismatches.push({
              saleId: sale.id,
              sqlite: sale.tokenNumber,
              neon: neonToken
            });
          }
        }
      }
    }

    // 4. Customer Khata Reconciliation
    const customers = await prisma.customer.findMany({ take: 5 });
    for (const c of customers) {
      // SQLite Calculation
      const sales = await prisma.sale.findMany({ where: { customerId: c.id } });
      const currentAmount = sales.reduce((sum, s) => sum + s.totalAmount, 0); // Simplified for audit
      const paidAmount = sales.reduce((sum, s) => sum + s.paidAmount, 0);
      
      // Neon Calculation
      const mapping = await prisma.localToCloudMapping.findFirst({ where: { entityType: 'Customer', localId: c.id } });
      if (mapping) {
        const neonSales = await neonClient.query(`SELECT total_amount, paid_amount FROM sales WHERE customer_uuid = $1`, [mapping.cloudUuid]);
        const neonCurrent = neonSales.rows.reduce((sum, s) => sum + s.total_amount, 0);
        const neonPaid = neonSales.rows.reduce((sum, s) => sum + s.paid_amount, 0);
        
        report.khata.push({
          customerId: c.id,
          sqlite: { total: currentAmount, paid: paidAmount },
          neon: { total: neonCurrent, paid: neonPaid },
          match: (currentAmount === neonCurrent && paidAmount === neonPaid)
        });
      }
    }

    // Write report
    fs.writeFileSync('phase4-report.json', JSON.stringify(report, null, 2));
    console.log('Phase 4 audit complete. Results written to phase4-report.json');

  } catch (error) {
    console.error('Audit failed:', error);
  } finally {
    neonClient.release();
    await prisma.$disconnect();
  }
}

runAudit();
