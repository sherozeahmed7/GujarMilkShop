import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

const NEON_TABLES: Record<string, string> = {
  User: 'users',
  Customer: 'customers',
  Supplier: 'suppliers',
  InventoryProduct: 'inventory_products',
  DailyRate: 'daily_rates',
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
  CashPerson: 'cash_persons',
  CashbookTransaction: 'cashbook_transactions',
};

const DEVICE_ID_KEY = 'deviceId';

async function run() {
  const client = await pool.connect();
  const report: any = {
    workerDiagnosis: {},
    pendingBreakdown: {},
    mappingAnalysis: {},
    missingFromNeon: {},
    orphanedMappings: {},
    extraInNeon: {},
    tableMissingMappings: {},
    dependencyNotes: [],
    phase5Design: {},
  };

  try {
    // ─── STEP 1: Worker Diagnosis ────────────────────────────────
    report.workerDiagnosis = {
      SYNC_WORKER_ENABLED: process.env.SYNC_WORKER_ENABLED,
      SYNC_API_URL: process.env.SYNC_API_URL || '(not set — defaults to http://localhost:5000/api/sync/batch)',
      SYNC_INTERNAL_SECRET_SET: !!process.env.SYNC_INTERNAL_SECRET,
      conclusion: 'SYNC_API_URL is not set in .env. Worker defaults to localhost:5000 which only works when the backend HTTP server is running. If the backend process is not running as a server (e.g. running as a sidecar), the sync worker will fail to reach the endpoint and silently leave records PENDING.',
    };

    // ─── STEP 2: Full PENDING record classification ─────────────
    const allPending = await prisma.syncQueue.findMany({
      where: { status: 'PENDING' },
      orderBy: [{ layer: 'asc' }, { createdAt: 'asc' }],
    });

    for (const r of allPending) {
      const et = r.entityType;
      if (!report.pendingBreakdown[et]) report.pendingBreakdown[et] = [];

      // Check SQLite row existence
      const localModel = et.charAt(0).toLowerCase() + et.slice(1);
      let sqliteExists = false;
      try {
        const row = await (prisma as any)[localModel].findUnique({ where: { id: r.localId } });
        sqliteExists = !!row;
      } catch (_) { sqliteExists = false; }

      // Check Neon existence
      let neonExists = false;
      if (NEON_TABLES[et]) {
        const nr = await client.query(`SELECT id FROM ${NEON_TABLES[et]} WHERE id=$1`, [r.cloudUuid]);
        neonExists = nr.rows.length > 0;
      }

      // Check mapping
      const mapping = await prisma.localToCloudMapping.findFirst({
        where: { entityType: et, localId: r.localId },
      });

      let classification = '';
      if (neonExists) classification = 'ALREADY_IN_NEON';
      else if (!sqliteExists) classification = 'ORPHANED_NO_LOCAL_ROW';
      else if (!mapping) classification = 'MAPPING_MISSING';
      else classification = 'CORRECTLY_PENDING';

      report.pendingBreakdown[et].push({
        eventUuid: r.eventUuid,
        localId: r.localId,
        cloudUuid: r.cloudUuid,
        operation: r.operation,
        layer: r.layer,
        retryCount: r.retryCount,
        error: r.error,
        sqliteExists,
        neonExists,
        mappingCloudUuid: mapping?.cloudUuid || null,
        classification,
      });
    }

    // ─── STEP 3: Mapping × Neon cross-check ──────────────────────
    const allMappings = await prisma.localToCloudMapping.findMany();
    for (const m of allMappings) {
      if (!NEON_TABLES[m.entityType]) {
        if (!report.mappingAnalysis[m.entityType]) report.mappingAnalysis[m.entityType] = { noNeonTable: 0 };
        report.mappingAnalysis[m.entityType].noNeonTable++;
        continue;
      }
      const neonRes = await client.query(`SELECT id FROM ${NEON_TABLES[m.entityType]} WHERE id=$1`, [m.cloudUuid]);
      const neonExists = neonRes.rows.length > 0;
      if (!report.mappingAnalysis[m.entityType]) {
        report.mappingAnalysis[m.entityType] = { matched: 0, orphaned: 0 };
      }
      if (neonExists) {
        report.mappingAnalysis[m.entityType].matched++;
      } else {
        report.mappingAnalysis[m.entityType].orphaned++;
        if (!report.orphanedMappings[m.entityType]) report.orphanedMappings[m.entityType] = [];
        report.orphanedMappings[m.entityType].push({ localId: m.localId, cloudUuid: m.cloudUuid });
      }
    }

    // ─── STEP 4: Tables missing mappings entirely ────────────────
    // (tables that have SQLite rows but 0 mappings)
    const mappedTypes = new Set(allMappings.map(m => m.entityType));
    const allPrismaModels: Record<string, string> = {
      User: 'user', Supplier: 'supplier', Customer: 'customer',
      InventoryProduct: 'inventoryProduct', DailyRate: 'dailyRate',
      Shift: 'shift', SupplierCollection: 'supplierCollection',
      SupplierPayment: 'supplierPayment', Sale: 'sale', SaleItem: 'saleItem',
      Payment: 'payment', Expense: 'expense', ExpensePayment: 'expensePayment',
      Return: 'return', ReturnItem: 'returnItem', InventoryMovement: 'inventoryMovement',
      CashPerson: 'cashPerson', CashbookTransaction: 'cashbookTransaction',
    };

    for (const [et, model] of Object.entries(allPrismaModels)) {
      const count = await (prisma as any)[model].count();
      const mappedCount = allMappings.filter(m => m.entityType === et).length;
      if (count > 0 && !mappedTypes.has(et)) {
        report.tableMissingMappings[et] = { sqliteCount: count, mappedCount: 0 };
      } else if (count !== mappedCount) {
        if (!report.tableMissingMappings[et]) {
          report.tableMissingMappings[et] = { sqliteCount: count, mappedCount };
        }
      }
    }

    // ─── STEP 5: Extra in Neon (Neon > SQLite) ───────────────────
    const neonExtraCheck = ['supplier_collections', 'supplier_payments', 'expenses', 'milk_product_daily_stocks', 'returns', 'return_items'];
    for (const t of neonExtraCheck) {
      const res = await client.query(`SELECT COUNT(*) FROM ${t}`);
      report.extraInNeon[t] = parseInt(res.rows[0].count, 10);
    }

  } finally {
    client.release();
    await pool.end();
    await prisma.$disconnect();
  }

  // Write report
  const fs = await import('fs');
  fs.writeFileSync('phase5-investigation.json', JSON.stringify(report, null, 2));
  console.log('Phase 5 investigation complete → phase5-investigation.json');
}

run().catch(console.error);
