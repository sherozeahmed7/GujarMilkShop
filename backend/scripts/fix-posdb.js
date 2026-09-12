/**
 * fix-posdb.js
 * Applies missing column migrations directly to the live pos.db in AppData.
 * Run with: node scripts/fix-posdb.js
 */
const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.join(appData, 'com.shero.tauri-app', 'pos.db');

if (!fs.existsSync(dbPath)) {
  console.error('❌ pos.db not found at:', dbPath);
  process.exit(1);
}

console.log('📂 Target database:', dbPath);

// Use prisma's query engine via env override
process.env.DATABASE_URL = 'file:' + dbPath;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  await prisma.$connect();
  console.log('✅ Connected to pos.db');

  // --- SupplierPayment.shiftId ---
  const spCols = await prisma.$queryRawUnsafe(`PRAGMA table_info("SupplierPayment")`);
  const hasShiftId = spCols.some(c => c.name === 'shiftId');
  if (!hasShiftId) {
    console.log('🔄 Adding SupplierPayment.shiftId ...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "SupplierPayment" ADD COLUMN "shiftId" INTEGER`);
    try {
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "SupplierPayment_shiftId_idx" ON "SupplierPayment"("shiftId")`
      );
    } catch (_) {}
    console.log('✅ SupplierPayment.shiftId added!');
  } else {
    console.log('✔  SupplierPayment.shiftId already exists, skipping.');
  }

  // --- Sale.tokenNumber ---
  const saleCols = await prisma.$queryRawUnsafe(`PRAGMA table_info("Sale")`);
  const hasToken = saleCols.some(c => c.name === 'tokenNumber');
  if (!hasToken) {
    console.log('🔄 Adding Sale.tokenNumber ...');
    await prisma.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN "tokenNumber" INTEGER NOT NULL DEFAULT 0`);
    console.log('✅ Sale.tokenNumber added!');
  } else {
    console.log('✔  Sale.tokenNumber already exists, skipping.');
  }

  // --- Shift.shiftDate ---
  console.log('🔄 Dropping Shift_shiftDate_key index...');
  try {
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "Shift_shiftDate_key"`);
    console.log('✅ Shift_shiftDate_key dropped!');
  } catch(e) {
    console.log('✔  Shift_shiftDate_key already dropped or not found.');
  }

  await prisma.$disconnect();
  console.log('\n🎉 Migration complete. Restart the app.');
}

run().catch(e => {
  console.error('❌ Error:', e.message || e);
  process.exit(1);
});
