require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const uuids = [
    '46609b1e-bb0e-4542-82c3-a61b586980d4',
    'ef9da755-13cd-4519-9203-991388a8dc8e',
    '2f8533ff-cc9d-4631-ae2b-20a30c1171d3',
    'dc097fb6-fab5-43b6-8564-91f4053b4ed6'
  ];

  console.log('Checking recently synced sales in Neon:');
  for (const uuid of uuids) {
    const res = await pool.query('SELECT id, total_amount, paid_amount, status, created_at FROM sales WHERE id = $1', [uuid]);
    console.log(uuid, '-> found:', res.rows);
  }

  // Also check latest sales inserted in Neon
  const latest = await pool.query('SELECT id, total_amount, paid_amount, status, created_at, updated_at FROM sales ORDER BY updated_at DESC NULLS LAST LIMIT 5');
  console.log('\nLatest updated sales in Neon:');
  console.log(latest.rows);

  await pool.end();
}

main().catch(console.error);
