import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';

async function checkMigrationOnExistingDb() {
  const testDb = path.resolve('prisma/test_sandbox/existing_db_migration_test.db');
  fs.mkdirSync(path.dirname(testDb), { recursive: true });
  fs.copyFileSync('prisma/template.db', testDb);

  const prisma = new PrismaClient({ datasources: { db: { url: 'file:' + testDb.replace(/\\/g, '/') } } });
  await prisma.$connect();

  // Insert mock existing sale
  await prisma.customer.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, name: 'Walk-in Customer', customerType: 'walk_in', status: 'active' }
  });

  const sale = await prisma.sale.create({
    data: {
      customerId: 1,
      totalAmount: 500,
      paidAmount: 500,
      remainingBalance: 0,
      saleType: 'walk_in',
      status: 'paid',
      tokenNumber: 42,
      cloudUuid: 'test-existing-sale-uuid'
    }
  });

  process.env.DATABASE_URL = 'file:' + testDb.replace(/\\/g, '/');
  // Run migration runner
  const { preparePendingDataMigrations, runPendingDataMigrations } = await import('../src/migrations/migrationRunner');
  const prepared = await preparePendingDataMigrations(prisma, testDb);
  console.log('Pending migrations detected count:', prepared.pendingMigrations.length);
  await runPendingDataMigrations(prisma, prepared);

  // Verify index exists and existing business data is 100% intact
  const indexes: any = await prisma.$queryRawUnsafe('PRAGMA index_list(Sale);');
  console.log('Sale indexes:', indexes.map((i: any) => i.name));
  const hasTokenIdx = indexes.some((i: any) => i.name === 'Sale_createdAt_tokenNumber_idx');

  const preservedSale = await prisma.sale.findUnique({ where: { id: sale.id } });
  console.log('Token index present:', hasTokenIdx ? 'PASS' : 'FAIL');
  console.log('Existing sale preserved:', preservedSale?.tokenNumber === 42 ? 'PASS' : 'FAIL');

  await prisma.$disconnect();
  try {
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
  } catch {}
}
checkMigrationOnExistingDb().catch(e => { console.error(e); process.exit(1); });
