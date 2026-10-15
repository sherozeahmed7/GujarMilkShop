const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

async function testScenario() {
  const original = path.join(process.env.APPDATA, 'com.shero.tauri-app', 'pos.db');
  const testDb = path.join(process.cwd(), 'test_scenario_old.db');
  fs.copyFileSync(original, testDb);

  const prisma = new PrismaClient({ datasources: { db: { url: `file:${testDb.replace(/\\/g, '/')}` } } });

  // 1. Simulate an older client database by removing migrations 13, 14, 15
  await prisma.$executeRawUnsafe('DELETE FROM "AppMigration" WHERE version >= 13;');
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "InventoryProduct" DROP COLUMN "sellPrice";');
  } catch (_) {}

  console.log('Simulated older client database prepared (missing v13, v14, v15 and sellPrice column).');

  const { preparePendingDataMigrations, runPendingDataMigrations } = require('../dist/migrations/migrationRunner');
  const prep = await preparePendingDataMigrations(prisma, testDb);
  console.log('Detected pending:', prep.pendingMigrations.map(m => `${m.version}: ${m.name}`));

  await runPendingDataMigrations(prisma, prep);
  console.log('Migration upgrade completed successfully with transactional VACUUM INTO + PRAGMA integrity_check!');

  // Check columns
  const cols = await prisma.$queryRawUnsafe('PRAGMA table_info("InventoryProduct");');
  console.log('Has sellPrice column now:', cols.some(c => c.name === 'sellPrice'));

  // Check integrity
  const check = await prisma.$queryRawUnsafe('PRAGMA integrity_check;');
  console.log('Integrity check result:', check);

  // Check repeated startup idempotency
  const prep2 = await preparePendingDataMigrations(prisma, testDb);
  console.log('Repeated startup pending count:', prep2.pendingMigrations.length);

  await prisma.$disconnect();
  try { fs.unlinkSync(testDb); } catch (_) {}
  console.log('Scenario test successfully concluded.');
}

testScenario().catch(err => {
  console.error('Scenario test error:', err);
  process.exit(1);
});
