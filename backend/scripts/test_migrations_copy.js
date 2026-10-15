const path = require('path');
const { PrismaClient } = require('@prisma/client');

// Use isolated test copy
const dbPath = path.join(process.cwd(), 'scratch_test_pos.db');
process.env.DATABASE_URL = `file:${dbPath.replace(/\\/g, '/')}`;

// Import custom migration runner
const { preparePendingDataMigrations, runPendingDataMigrations } = require('../dist/migrations/migrationRunner');

async function testMigrations() {
  const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
  });

  console.log('--- STEP 1: PREPARE PENDING MIGRATIONS ---');
  const prep = await preparePendingDataMigrations(prisma, dbPath);
  console.log('Pending count:', prep.pendingMigrations.length);
  console.log('Pending versions:', prep.pendingMigrations.map(m => `${m.version}: ${m.name}`));

  console.log('--- STEP 2: EXECUTE MIGRATIONS ---');
  await runPendingDataMigrations(prisma, prep);
  console.log('Migration execution completed successfully.');

  console.log('--- STEP 3: VERIFY IDEMPOTENCY (RE-RUNNING) ---');
  const prep2 = await preparePendingDataMigrations(prisma, dbPath);
  console.log('Pending count on re-run:', prep2.pendingMigrations.length);

  console.log('--- STEP 4: VERIFY NEW INDEXES & QUERY PLAN ---');
  const indexes = await prisma.$queryRawUnsafe('SELECT name, tbl_name FROM sqlite_master WHERE type="index";');
  const targetIndexes = indexes.filter(i => ['Sale', 'Expense'].includes(i.tbl_name));
  console.log('Indexes present:', targetIndexes.map(i => i.name));

  const eqp1 = await prisma.$queryRawUnsafe(`
    EXPLAIN QUERY PLAN
    SELECT * FROM Expense WHERE date >= '2026-10-01' AND date <= '2026-10-11';
  `);
  console.log('Expense date range plan (with 015 index):', eqp1);

  const eqp2 = await prisma.$queryRawUnsafe(`
    EXPLAIN QUERY PLAN
    SELECT customerId, SUM(remainingBalance) FROM Sale
    WHERE remainingBalance > 0 AND customerId IS NOT NULL
    GROUP BY customerId;
  `);
  console.log('Sale customer balance plan (with 015 index):', eqp2);

  await prisma.$disconnect();
}

testMigrations().catch(err => {
  console.error('Migration test error:', err);
  process.exit(1);
});
