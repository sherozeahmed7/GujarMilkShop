require('dotenv').config();
const { Pool } = require('pg');

const EXECUTE = process.argv.includes('--execute');
const UUID = '00000000-0000-4000-8000-000000000001';

async function main() {
  const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL_NEON;
  if (!connectionString) throw new Error('NEON_DATABASE_URL or DATABASE_URL_NEON is required');
  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('LOCK TABLE customers, sales IN SHARE ROW EXCLUSIVE MODE');

    const before = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM customers WHERE customer_type='walk_in') AS customer_count,
        (SELECT COUNT(*)::int FROM sales WHERE sale_type='walk_in') AS sale_count,
        (SELECT COUNT(*)::int FROM sales WHERE sale_type='walk_in' AND customer_uuid IS DISTINCT FROM $1::uuid) AS sales_to_repoint
    `, [UUID]);

    if (!EXECUTE) {
      await client.query('ROLLBACK');
      console.log(JSON.stringify({ mode: 'dry-run', ...before.rows[0] }, null, 2));
      return;
    }

    await client.query(`
      INSERT INTO customers
        (id, local_id, device_id, name, customer_type, status, created_at, updated_at)
      VALUES ($1, 0, 'system-walk-in', 'Walk-In Customer', 'walk_in', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        name=EXCLUDED.name, customer_type='walk_in', status='active', updated_at=CURRENT_TIMESTAMP
    `, [UUID]);
    await client.query(
      `UPDATE sales SET customer_uuid=$1 WHERE sale_type='walk_in' AND customer_uuid IS DISTINCT FROM $1::uuid`,
      [UUID]
    );
    await client.query(
      `DELETE FROM customers WHERE customer_type='walk_in' AND id<>$1`,
      [UUID]
    );
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS customers_single_walk_in_key
      ON customers(customer_type) WHERE customer_type='walk_in'
    `);
    await client.query('COMMIT');

    const after = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM customers WHERE customer_type='walk_in') AS customer_count,
        (SELECT COUNT(*)::int FROM sales WHERE sale_type='walk_in') AS sale_count,
        (SELECT COUNT(*)::int FROM sales WHERE sale_type='walk_in' AND customer_uuid=$1) AS linked_sale_count
    `, [UUID]);
    console.log(JSON.stringify({ mode: 'execute', before: before.rows[0], after: after.rows[0] }, null, 2));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

