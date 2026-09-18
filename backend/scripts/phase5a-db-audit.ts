import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

const TABLES = {
  User: 'users',
  Supplier: 'suppliers',
  Customer: 'customers',
  DailyRate: 'daily_rates',
  InventoryProduct: 'inventory_products',
  MilkProductDailyStock: 'milk_product_daily_stocks',
  Shift: 'shifts',
  Sale: 'sales',
  SaleItem: 'sale_items',
  Payment: 'payments',
  SupplierCollection: 'supplier_collections',
  SupplierPayment: 'supplier_payments',
  Expense: 'expenses',
  ExpensePayment: 'expense_payments',
  Return: 'returns',
  ReturnItem: 'return_items',
  InventoryMovement: 'inventory_movements',
  MilkProductTransaction: 'milk_product_transactions',
  ButterGheeConversion: 'butter_ghee_conversions',
  CashPerson: 'cash_persons',
  CashbookTransaction: 'cashbook_transactions'
};

async function run() {
  const neonClient = await pool.connect();
  const report: any = {
    counts: {},
    queue: {},
    e2e: {},
    neonOnly: {},
    fieldMismatch: {},
    brokenRels: []
  };

  try {
    for (const [entityType, neonTable] of Object.entries(TABLES)) {
      const modelName = entityType.charAt(0).toLowerCase() + entityType.slice(1);
      let sqliteCount = 0;
      try {
        sqliteCount = await (prisma as any)[modelName].count();
      } catch (e) {
        sqliteCount = -1;
      }

      const neonRes = await neonClient.query(`SELECT COUNT(*) FROM ${neonTable}`);
      const neonCount = parseInt(neonRes.rows[0].count, 10);

      const mappingCount = await prisma.localToCloudMapping.count({ where: { entityType } });
      
      report.counts[entityType] = { sqliteCount, neonCount, mappingCount };

      if (sqliteCount > 0) {
        const sampleLocal = await (prisma as any)[modelName].findFirst({ orderBy: { id: 'desc' } });
        const mapping = await prisma.localToCloudMapping.findFirst({ where: { entityType, localId: sampleLocal.id } });
        if (mapping) {
          const neonRowRes = await neonClient.query(`SELECT * FROM ${neonTable} WHERE id = $1`, [mapping.cloudUuid]);
          if (neonRowRes.rows.length === 1) {
            report.counts[entityType].sampleMapped = true;
            report.counts[entityType].sampleFoundInNeon = true;
            
            const nRow = neonRowRes.rows[0];
            const mismatches = [];
            if (entityType === 'Sale') {
              if (String(nRow.total_amount) !== String(sampleLocal.totalAmount)) mismatches.push('totalAmount');
              if (String(nRow.token_number) !== String(sampleLocal.tokenNumber)) mismatches.push('tokenNumber');
            } else if (entityType === 'Payment') {
              if (String(nRow.amount) !== String(sampleLocal.amount)) mismatches.push('amount');
            }
            if (mismatches.length > 0) {
              report.fieldMismatch[entityType] = mismatches;
            }
          } else {
            report.counts[entityType].sampleFoundInNeon = false;
          }
        }
      }

      const allNeonRes = await neonClient.query(`SELECT id FROM ${neonTable}`);
      const allNeonIds = allNeonRes.rows.map(r => r.id);
      
      const allMappings = await prisma.localToCloudMapping.findMany({ where: { entityType } });
      const mappedCloudIds = new Set(allMappings.map(m => m.cloudUuid));
      
      let neonOnly = 0;
      for (const id of allNeonIds) {
        if (!mappedCloudIds.has(id)) neonOnly++;
      }
      report.neonOnly[entityType] = neonOnly;
    }

    const queueGroups = await prisma.syncQueue.groupBy({ by: ['status'], _count: { _all: true } });
    for (const g of queueGroups) {
      report.queue[g.status] = g._count._all;
    }

    const latestSale = await prisma.sale.findFirst({ orderBy: { id: 'desc' }, include: { items: true, payments: true } });
    if (latestSale) {
      const saleMap = await prisma.localToCloudMapping.findFirst({ where: { entityType: 'Sale', localId: latestSale.id } });
      if (saleMap) {
        const neonSale = await neonClient.query(`SELECT * FROM sales WHERE id = $1`, [saleMap.cloudUuid]);
        report.e2e.saleSync = neonSale.rows.length === 1;
        report.e2e.saleToken = neonSale.rows[0]?.token_number === latestSale.tokenNumber;
      }
    }

    console.log(JSON.stringify(report, null, 2));

  } catch (e: any) {
    console.error("Audit script failed:", e.message);
  } finally {
    neonClient.release();
    await pool.end();
    await prisma.$disconnect();
  }
}
run();
