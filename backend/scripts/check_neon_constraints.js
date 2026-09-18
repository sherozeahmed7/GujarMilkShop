const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query(`
      SELECT conname, pg_get_constraintdef(c.oid) as def 
      FROM pg_constraint c 
      JOIN pg_namespace n ON n.oid = c.connamespace 
      WHERE conrelid = 'shifts'::regclass
    `);
    console.log('=== SHIFTS CONSTRAINTS ===');
    console.log(JSON.stringify(res.rows, null, 2));

    const salesRef = await client.query(`
      SELECT id, shift_uuid, token_number, created_at FROM sales LIMIT 5
    `);
    console.log('=== SALES SAMPLE (SHIFT_UUID) ===');
    console.log(JSON.stringify(salesRef.rows, null, 2));

    const movRef = await client.query(`
      SELECT id, shift_uuid, product_uuid, quantity FROM inventory_movements LIMIT 5
    `);
    console.log('=== INVENTORY MOVEMENTS SAMPLE (SHIFT_UUID) ===');
    console.log(JSON.stringify(movRef.rows, null, 2));

  } finally {
    client.release();
    await pool.end();
  }
}
check();
