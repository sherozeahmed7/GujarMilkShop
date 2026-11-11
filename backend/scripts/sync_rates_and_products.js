require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getNeonPool } = require('../dist/config/neonDb');

async function syncDailyRatesAndInventory() {
  const pool = getNeonPool();

  console.log('--- Checking local DailyRates ---');
  const rates = await prisma.dailyRate.findMany();
  console.log(`Found ${rates.length} local daily rates`);

  for (const r of rates) {
    const rateDate = r.date ? new Date(r.date) : new Date();
    await pool.query(`
      INSERT INTO daily_rates (id, local_id, device_id, milk_rate, yogurt_rate, lassi_rate, butter_rate, ghee_rate, updated_by_role, date, created_at, updated_at)
      VALUES (
        COALESCE($1::uuid, uuid_generate_v4()),
        $2,
        'DESKTOP_PRIMARY',
        $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP
      )
      ON CONFLICT (device_id, local_id) DO UPDATE SET
        milk_rate = EXCLUDED.milk_rate,
        yogurt_rate = EXCLUDED.yogurt_rate,
        lassi_rate = EXCLUDED.lassi_rate,
        butter_rate = EXCLUDED.butter_rate,
        ghee_rate = EXCLUDED.ghee_rate,
        updated_by_role = EXCLUDED.updated_by_role,
        date = EXCLUDED.date,
        updated_at = CURRENT_TIMESTAMP
    `, [
      r.cloudUuid || null,
      r.id,
      r.milkRate || 0,
      r.yogurtRate || 0,
      r.lassiRate || 0,
      r.butterRate || 0,
      r.gheeRate || 0,
      r.updatedByRole || 'Admin',
      rateDate,
      r.createdAt || rateDate
    ]);
  }
  console.log(`Synced ${rates.length} daily rates to Neon`);

  console.log('--- Checking local Inventory Products ---');
  const products = await prisma.inventoryProduct.findMany();
  console.log(`Found ${products.length} local inventory products`);

  for (const p of products) {
    await pool.query(`
      INSERT INTO inventory_products (id, local_id, device_id, code, name, description, category, unit, tax, low_stock_threshold, is_active, is_locked, created_at, updated_at)
      VALUES (
        COALESCE($1::uuid, uuid_generate_v4()),
        $2,
        'DESKTOP_PRIMARY',
        $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        unit = EXCLUDED.unit,
        tax = EXCLUDED.tax,
        low_stock_threshold = EXCLUDED.low_stock_threshold,
        is_active = EXCLUDED.is_active,
        is_locked = EXCLUDED.is_locked,
        updated_at = CURRENT_TIMESTAMP
    `, [
      p.cloudUuid || null,
      p.id,
      p.code,
      p.name,
      p.description || null,
      p.category || 'Dairy',
      p.unit || 'kg',
      p.tax || 'exempt',
      p.lowStockThreshold || 0,
      p.isActive !== undefined ? p.isActive : true,
      p.isLocked || false
    ]);
  }
  console.log(`Synced ${products.length} inventory products to Neon`);

  await pool.end();
  await prisma.$disconnect();
  console.log('Done!');
}

syncDailyRatesAndInventory().catch(console.error);

