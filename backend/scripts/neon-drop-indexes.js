require('dotenv').config();
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  const client = await pool.connect();
  
  try {
    const sizeBefore = await client.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
    console.log(`Database size BEFORE: ${sizeBefore.rows[0].size}`);

    console.log('Dropping unused indexes...');
    await client.query('DROP INDEX IF EXISTS idx_cloud_sync_events_entity');
    await client.query('DROP INDEX IF EXISTS idx_cloud_sync_events_device');
    console.log('Indexes dropped.');

    const sizeAfter = await client.query("SELECT pg_size_pretty(pg_database_size(current_database())) as size");
    console.log(`Database size AFTER: ${sizeAfter.rows[0].size}`);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    pool.end();
  }
}
run();
