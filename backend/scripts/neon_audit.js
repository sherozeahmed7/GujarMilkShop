require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.NEON_DATABASE_URL, 
  ssl: { rejectUnauthorized: true } 
});

async function main() {
  try {
    // Neon counts
    const tables = ['customers','sales','sale_items','users','activity_logs','suppliers','payments','returns'];
    console.log('=== NEON DATABASE COUNTS ===');
    for (const t of tables) {
      const r = await pool.query(`SELECT COUNT(*) as c FROM ${t}`);
      console.log(`${t}: ${r.rows[0].c}`);
    }

    // Check SyncQueue in Neon (it exists as a table there too)
    const sqNeon = await pool.query('SELECT COUNT(*) as c FROM "SyncQueue"');
    console.log(`\nSyncQueue in Neon: ${sqNeon.rows[0].c}`);

    // Most recent sales in Neon
    const recentSales = await pool.query('SELECT uuid, created_at, total_amount FROM sales ORDER BY created_at DESC LIMIT 5');
    console.log('\n=== 5 Most Recent Neon Sales ===');
    recentSales.rows.forEach(r => console.log(JSON.stringify(r)));

    // Most recent customers in Neon
    const recentCustomers = await pool.query('SELECT uuid, name, created_at FROM customers ORDER BY created_at DESC LIMIT 5');
    console.log('\n=== 5 Most Recent Neon Customers ===');
    recentCustomers.rows.forEach(r => console.log(JSON.stringify(r)));

    pool.end();
  } catch(e) {
    console.error('Error:', e.message);
    pool.end();
  }
}

main();
