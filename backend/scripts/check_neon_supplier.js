require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const res = await pool.query("SELECT id, name, code, is_active FROM suppliers WHERE id = '25b22b8c-cd4f-4ce5-b0fa-be8f90fc6309'");
  console.log('Supplier in Neon:', res.rows);

  const allSupp = await pool.query("SELECT COUNT(*) FROM suppliers");
  console.log('Total suppliers in Neon:', allSupp.rows[0].count);

  await pool.end();
}

main().catch(console.error);
