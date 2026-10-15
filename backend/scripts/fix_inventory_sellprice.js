const { PrismaClient } = require('@prisma/client');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'com.shero.tauri-app', 'pos.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath.replace(/\\/g, '/')}` } } });

async function check() {
  const migrations = await prisma.$queryRawUnsafe('SELECT * FROM AppMigration;');
  console.log('Applied migrations:', migrations.map(m => `${m.version}: ${m.name}`));

  // Check if sellPrice column exists
  const cols = await prisma.$queryRawUnsafe('PRAGMA table_info("InventoryProduct");');
  const hasSellPrice = cols.some(c => c.name === 'sellPrice');
  console.log('Has sellPrice column:', hasSellPrice);

  if (!hasSellPrice) {
    console.log('Applying ALTER TABLE to add sellPrice column directly...');
    await prisma.$executeRawUnsafe('ALTER TABLE "InventoryProduct" ADD COLUMN "sellPrice" REAL NOT NULL DEFAULT 0;');
    console.log('sellPrice column added successfully!');
  }

  // Ensure v13 is recorded in AppMigration if not present
  const hasV13 = migrations.some(m => m.version === 13);
  if (!hasV13) {
    console.log('Recording v13 in AppMigration table...');
    await prisma.$executeRawUnsafe(
      'INSERT INTO "AppMigration" ("version", "name", "appliedAt", "checksum") VALUES (13, "inventory_product_sell_price", CURRENT_TIMESTAMP, "v13_fix");'
    );
    console.log('v13 recorded!');
  }

  const colsAfter = await prisma.$queryRawUnsafe('PRAGMA table_info("InventoryProduct");');
  console.log('Columns after fix:', colsAfter.map(c => c.name));

  await prisma.$disconnect();
}
check().catch(console.error);
