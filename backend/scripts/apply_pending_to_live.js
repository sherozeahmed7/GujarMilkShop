const { PrismaClient } = require('@prisma/client');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'com.shero.tauri-app', 'pos.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath.replace(/\\/g, '/')}` } } });

async function run() {
  const { preparePendingDataMigrations, runPendingDataMigrations } = require('../dist/migrations/migrationRunner');
  console.log('Preparing migrations for live pos.db:', dbPath);
  const prep = await preparePendingDataMigrations(prisma, dbPath);
  console.log('Pending migrations:', prep.pendingMigrations.map(m => `${m.version}: ${m.name}`));
  await runPendingDataMigrations(prisma, prep);
  console.log('Migrations applied successfully!');

  const cols = await prisma.$queryRawUnsafe('PRAGMA table_info("InventoryProduct");');
  console.log('InventoryProduct columns now:', cols.map(c => c.name));
  await prisma.$disconnect();
}

run().catch(err => {
  console.error('Migration execution failed:', err);
  process.exit(1);
});
