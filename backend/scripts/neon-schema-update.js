// Let's write it in JS and use pg directly.

// Let's write it in JS and use pg directly.
const { Pool } = require('pg');
require('dotenv').config();

async function run() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL
  });

  const client = await pool.connect();
  try {
    console.log('Beginning Neon Schema Update...');
    await client.query('BEGIN');

    // 1. Add token_number to sales
    await client.query(`ALTER TABLE sales ADD COLUMN IF NOT EXISTS token_number INTEGER DEFAULT 0;`);
    console.log('Added token_number to sales.');

    // 2. Create cash_persons
    await client.query(`
      CREATE TABLE IF NOT EXISTS cash_persons (
        id UUID PRIMARY KEY,
        device_id VARCHAR(50) NOT NULL,
        local_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        type TEXT NOT NULL,
        description TEXT,
        opening_balance DOUBLE PRECISION DEFAULT 0,
        customer_type TEXT NOT NULL,
        status TEXT DEFAULT 'Active',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (device_id, local_id)
      );
    `);
    console.log('Created cash_persons table.');

    // 3. Create cashbook_transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS cashbook_transactions (
        id UUID PRIMARY KEY,
        device_id VARCHAR(50) NOT NULL,
        local_id INTEGER NOT NULL,
        cash_person_uuid UUID NOT NULL REFERENCES cash_persons(id) ON DELETE CASCADE,
        cash_person_name TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        created_by TEXT DEFAULT 'Admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE (device_id, local_id)
      );
    `);
    console.log('Created cashbook_transactions table.');

    await client.query('COMMIT');
    console.log('Neon Schema Update Complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating schema:', err);
  } finally {
    client.release();
    pool.end();
  }
}

run();
