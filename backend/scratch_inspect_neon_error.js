require('dotenv').config();
const { Pool } = require('pg');

async function inspect() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('Connecting to Neon...');
    
    // Check returns table columns
    const retCols = await pool.query(`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'returns'
    `);
    console.log('\n--- returns table columns ---');
    console.table(retCols.rows);

    // Check users table columns and records
    const users = await pool.query(`SELECT id, device_id, local_id, email, name, role FROM users`);
    console.log('\n--- users table records ---');
    console.table(users.rows);

    // Check unique constraints on users
    const userConstraints = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'users'::regclass
    `);
    console.log('\n--- users constraints ---');
    console.table(userConstraints.rows);

    // Check unique constraints on cloud_sync_events
    const eventConstraints = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'cloud_sync_events'::regclass
    `);
    console.log('\n--- cloud_sync_events constraints ---');
    console.table(eventConstraints.rows);

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

inspect();
