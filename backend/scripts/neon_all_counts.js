require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const tables = [
    'users', 'suppliers', 'inventory_products', 'daily_rates', 'customers',
    'shifts', 'supplier_collections', 'supplier_payments', 'sales', 'sale_items',
    'payments', 'expenses', 'expense_payments', 'inventory_movements',
    'butter_ghee_conversions', 'milk_product_daily_stocks', 'returns',
    'return_items', 'audit_records', 'cash_persons', 'cashbook_transactions',
    'activity_logs'
  ];

  console.log('=== NEON TABLE ROW COUNTS ===');
  for (const table of tables) {
    try {
      const res = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
      console.log(`${table.padEnd(28)}: ${res.rows[0].count}`);
    } catch (err) {
      console.log(`${table.padEnd(28)}: ERROR (${err.message})`);
    }
  }

  await pool.end();
}

main().catch(console.error);
