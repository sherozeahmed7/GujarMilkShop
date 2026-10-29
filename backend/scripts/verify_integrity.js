const { PrismaClient } = require('@prisma/client');
const path = require('path');
const os = require('os');
const { Pool } = require('pg');
require('dotenv').config();

const appDataDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.shero.tauri-app', 'pos.db');
const prisma = new PrismaClient({
  datasources: {
    db: { url: `file:${appDataDbPath}?connection_limit=1&socket_timeout=3` }
  }
});

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  // Check duplicate cloud_uuids in Neon for key tables
  const tables = ['sales', 'sale_items', 'payments', 'supplier_collections', 'supplier_payments', 'customers', 'suppliers'];
  console.log('=== CHECKING DUPLICATE UUIDs IN NEON ===');
  for (const t of tables) {
    const res = await pool.query(`SELECT id, COUNT(*) FROM ${t} GROUP BY id HAVING COUNT(*) > 1`);
    console.log(`${t.padEnd(25)} duplicate UUIDs: ${res.rows.length}`);
  }

  // Check local SQLite business counts
  const customers = await prisma.customer.count();
  const sales = await prisma.sale.count();
  const users = await prisma.user.count();
  const suppliers = await prisma.supplier.count();
  const collections = await prisma.supplierCollection.count();
  const payments = await prisma.supplierPayment.count();

  console.log('\n=== LOCAL SQLITE BUSINESS DATA COUNTS (UNCHANGED) ===');
  console.log('Customer:           ', customers);
  console.log('Sale:               ', sales);
  console.log('User:               ', users);
  console.log('Supplier:           ', suppliers);
  console.log('SupplierCollection: ', collections);
  console.log('SupplierPayment:    ', payments);

  // Check failed count
  const failedCount = await prisma.syncQueue.count({ where: { status: 'FAILED' } });
  console.log('\nCurrent FAILED events in SyncQueue:', failedCount);

  await pool.end();
  await prisma.$disconnect();
}

main().catch(console.error);
