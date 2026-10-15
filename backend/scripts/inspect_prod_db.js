const path = require('path');
const { PrismaClient } = require('@prisma/client');

const dbPath = path.join(process.env.APPDATA, 'com.shero.tauri-app', 'pos.db');
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath.replace(/\\/g, '/')}` } }
});

async function main() {
  const version = await prisma.$queryRawUnsafe('PRAGMA user_version;');
  const sqliteVer = await prisma.$queryRawUnsafe('SELECT sqlite_version() as ver;');
  const indexes = await prisma.$queryRawUnsafe('SELECT name, tbl_name, sql FROM sqlite_master WHERE type="index";');
  const appliedMigrations = await prisma.$queryRawUnsafe('SELECT * FROM "AppMigration";');

  console.log('=== SQLITE INFO ===');
  console.log('SQLite Version:', sqliteVer);
  console.log('User Version:', version);

  console.log('=== APPLIED MIGRATIONS ===');
  console.log(appliedMigrations.map(m => `${m.version}: ${m.name} (${m.appliedAt})`));

  console.log('=== RELEVANT INDEXES ===');
  const targetIndexes = indexes.filter(i => ['Sale', 'Expense'].includes(i.tbl_name));
  console.log(JSON.stringify(targetIndexes, null, 2));

  // EXPLAIN QUERY PLAN benchmarks
  console.log('=== EXPLAIN QUERY PLANS ===');
  const eqp1 = await prisma.$queryRawUnsafe(`
    EXPLAIN QUERY PLAN
    SELECT * FROM Expense WHERE date >= '2026-10-01' AND date <= '2026-10-11';
  `);
  console.log('Expense date range EQP:', eqp1);

  const eqp2 = await prisma.$queryRawUnsafe(`
    EXPLAIN QUERY PLAN
    SELECT customerId, SUM(remainingBalance) FROM Sale
    WHERE remainingBalance > 0 AND customerId IS NOT NULL
    GROUP BY customerId;
  `);
  console.log('Sale customer balance EQP:', eqp2);

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
