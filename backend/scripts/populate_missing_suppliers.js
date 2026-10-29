const { PrismaClient } = require('@prisma/client');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const appDataDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.shero.tauri-app', 'pos.db');
const deviceIdPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.shero.tauri-app', '.device-id');
let deviceId = '22c20868-1f31-49d7-86f9-ecd644610b56';
if (fs.existsSync(deviceIdPath)) {
  deviceId = fs.readFileSync(deviceIdPath, 'utf8').trim();
}

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

  const localSuppliers = await prisma.supplier.findMany();
  console.log(`Local SQLite suppliers: ${localSuppliers.length}`);
  console.log(`Using deviceId: ${deviceId}`);

  const neonRes = await pool.query('SELECT id, name FROM suppliers');
  const neonSupplierIds = new Set(neonRes.rows.map(r => r.id));
  console.log(`Neon suppliers currently: ${neonSupplierIds.size}`);

  let insertedToNeon = 0;
  for (const s of localSuppliers) {
    if (!neonSupplierIds.has(s.cloudUuid)) {
      console.log(`Inserting missing supplier to Neon: ${s.name} (id: ${s.id}, uuid: ${s.cloudUuid})`);
      await pool.query(`
        INSERT INTO suppliers (
          id, local_id, device_id, name, code, phone, default_rate, cow_rate, buffalo_rate,
          cycle_type, is_active, guaranteed_advance, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
        ) ON CONFLICT (id) DO UPDATE SET
          local_id = EXCLUDED.local_id,
          device_id = EXCLUDED.device_id,
          name = EXCLUDED.name,
          updated_at = EXCLUDED.updated_at
      `, [
        s.cloudUuid,
        s.id,
        deviceId,
        s.name,
        s.code || String(s.id),
        s.phone,
        s.defaultRate || 0,
        s.cowRate || 0,
        s.buffaloRate || 0,
        s.cycleType || 'Daily',
        s.isActive ?? true,
        s.guaranteedAdvance || 0,
        s.createdAt || new Date(),
        s.updatedAt || new Date()
      ]);
      insertedToNeon++;
    }
  }

  console.log(`\nSuccessfully populated ${insertedToNeon} missing suppliers into Neon!`);

  const neonAfter = await pool.query('SELECT COUNT(*) FROM suppliers');
  console.log(`Total suppliers in Neon now: ${neonAfter.rows[0].count}`);

  await pool.end();
  await prisma.$disconnect();
}

main().catch(console.error);
