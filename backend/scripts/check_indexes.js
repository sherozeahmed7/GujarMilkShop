const { Pool } = require('pg');
require('dotenv').config();

async function checkIndexes() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const res = await pool.query(`
    SELECT tablename, indexname 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    ORDER BY tablename, indexname;
  `);
  console.log('Public indexes in Neon:');
  console.table(res.rows);
  await pool.end();
}

checkIndexes();
