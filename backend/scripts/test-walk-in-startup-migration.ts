import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  preparePendingDataMigrations,
  runPendingDataMigrations,
} from '../src/migrations/migrationRunner';
import {
  getFinancialSnapshot,
  WALK_IN_CUSTOMER_MIGRATION_KEY,
} from '../src/migrations/walkInCustomerCanonicalV1';
import { WALK_IN_CUSTOMER_CLOUD_UUID } from '../src/config/walkInCustomer';

const template = path.resolve(__dirname, '../prisma/template.db');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gms-walk-in-migration-'));

async function fixture(name: string): Promise<{ db: PrismaClient; dbPath: string }> {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  const dbPath = path.join(dir, 'pos.db');
  fs.copyFileSync(template, dbPath);
  process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;
  const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  await db.$connect();
  await db.$executeRawUnsafe(`DROP INDEX IF EXISTS "Customer_single_walk_in_key"`);
  await db.$executeRawUnsafe(`DROP TABLE IF EXISTS "app_migrations"`);
  await db.syncQueue.deleteMany();
  await db.localToCloudMapping.deleteMany();
  await db.payment.deleteMany();
  await db.saleItem.deleteMany();
  await db.sale.deleteMany();
  await db.customer.deleteMany();
  return { db, dbPath };
}

async function createSale(db: PrismaClient, customerId: number | null, month = '2026-01-15T10:00:00.000Z') {
  const sale = await db.sale.create({
    data: {
      saleType: 'walk_in', customerId, customerName: 'Walk-In Customer', totalAmount: 500,
      paidAmount: 400, remainingBalance: 100, status: 'partial', tokenNumber: 17,
      createdAt: new Date(month), updatedAt: new Date(month),
    },
  });
  await db.saleItem.create({ data: { saleId: sale.id, itemName: 'milk', quantity: 2, unitPrice: 250, totalPrice: 500 } });
  await db.payment.create({ data: { saleId: sale.id, method: 'cash', amount: 400, status: 'completed' } });
  return sale;
}

async function migrate(db: PrismaClient) {
  const prepared = await preparePendingDataMigrations(db);
  assert.equal(prepared.pending, true);
  assert.ok(prepared.backupPath && fs.statSync(prepared.backupPath).size > 0);
  await runPendingDataMigrations(db, prepared);
}

async function assertCommon(db: PrismaClient, expectedSales: number) {
  const walkIns = await db.customer.findMany({ where: { customerType: 'walk_in' } });
  assert.equal(walkIns.length, 1);
  assert.equal(await db.sale.count({ where: { saleType: 'walk_in', customerId: walkIns[0].id } }), expectedSales);
  const mapping = await db.localToCloudMapping.findFirst({ where: { entityType: 'Customer', localId: walkIns[0].id } });
  assert.equal(mapping?.cloudUuid, WALK_IN_CUSTOMER_CLOUD_UUID);
  const marker = await db.$queryRawUnsafe<Array<{ status: string }>>(
    `SELECT status FROM app_migrations WHERE migration_key = ?`, WALK_IN_CUSTOMER_MIGRATION_KEY
  );
  assert.equal(marker[0]?.status, 'COMPLETE');
}

async function main() {
  assert.ok(fs.existsSync(template), `Template DB missing: ${template}`);

  // A: no Walk-In customer; genuine historical Walk-In sale has NULL customer.
  {
    const { db } = await fixture('state-a-old');
    const sale = await createSale(db, null);
    const splitSale = await db.sale.create({
      data: {
        saleType: 'split', customerId: null, totalAmount: 300, paidAmount: 150,
        remainingBalance: 150, status: 'partial', tokenNumber: 18,
      },
    });
    const before = await db.$transaction((tx) => getFinancialSnapshot(tx));
    await migrate(db);
    await assertCommon(db, 1);
    assert.deepEqual(await db.$transaction((tx) => getFinancialSnapshot(tx)), before);
    assert.equal((await db.sale.findUniqueOrThrow({ where: { id: sale.id } })).tokenNumber, 17);
    assert.equal((await db.sale.findUniqueOrThrow({ where: { id: splitSale.id } })).customerId, null,
      'nullable split sale must never be reclassified as Walk-In');
    await db.$disconnect();
  }

  // B: duplicate Walk-In customers and references converge without deleting sales.
  {
    const { db } = await fixture('state-b-duplicates');
    const rows = await Promise.all([1, 2, 3].map((n) => db.customer.create({ data: { name: `Walk-In ${n}`, customerType: 'walk_in' } })));
    for (const row of rows) await createSale(db, row.id);
    await migrate(db);
    await assertCommon(db, 3);
    assert.equal(await db.sale.count(), 3);
    await db.$disconnect();
  }

  // C/F: completed migration is a true no-op on every later startup.
  {
    const { db } = await fixture('state-c-already');
    await createSale(db, null);
    await migrate(db);
    const queueCount = await db.syncQueue.count();
    const customerCount = await db.customer.count();
    const second = await preparePendingDataMigrations(db);
    assert.equal(second.pending, false);
    await runPendingDataMigrations(db, second);
    assert.equal(await db.syncQueue.count(), queueCount);
    assert.equal(await db.customer.count(), customerCount);
    await db.$disconnect();
  }

  // D: partially migrated rows are retained; only unresolved relationships move.
  {
    const { db } = await fixture('state-d-partial');
    const canonical = await db.customer.create({ data: { name: 'Walk-In Customer', customerType: 'walk_in' } });
    const duplicate = await db.customer.create({ data: { name: 'Old Walk-In', customerType: 'walk_in' } });
    await createSale(db, canonical.id);
    await createSale(db, duplicate.id, '2026-02-10T10:00:00.000Z');
    await createSale(db, null, '2026-03-10T10:00:00.000Z');
    await migrate(db);
    await assertCommon(db, 3);
    const saleEvents = await db.syncQueue.count({ where: { entityType: 'Sale' } });
    assert.equal(saleEvents, 2, 'already-correct sale must not be rewritten or re-queued');
    await db.$disconnect();
  }

  // E: a financial mutation detected during migration aborts and rolls back all migration work.
  {
    const { db } = await fixture('state-e-rollback');
    const sale = await createSale(db, null);
    await db.$executeRawUnsafe(`
      CREATE TRIGGER "test_financial_mismatch" AFTER UPDATE OF "customerId" ON "Sale"
      BEGIN UPDATE "Sale" SET "totalAmount" = "totalAmount" + 1 WHERE "id" = NEW."id"; END
    `);
    const prepared = await preparePendingDataMigrations(db);
    await assert.rejects(() => runPendingDataMigrations(db, prepared), /Financial integrity validation failed/);
    const rolledBack = await db.sale.findUniqueOrThrow({ where: { id: sale.id } });
    assert.equal(rolledBack.customerId, null);
    assert.equal(rolledBack.totalAmount, 500);
    assert.equal(await db.customer.count({ where: { customerType: 'walk_in' } }), 0);
    const markerTable = await db.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='app_migrations'`
    );
    assert.equal(markerTable.length, 0, 'migration marker DDL must roll back with data');
    await db.$disconnect();
  }

  console.log(JSON.stringify({ result: 'PASS', cases: ['A', 'B', 'C', 'D', 'E', 'F'], tempRoot: root }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
