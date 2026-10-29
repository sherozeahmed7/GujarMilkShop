require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: true } });

async function run() {
  // Check activity_logs existence
  const r1 = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='activity_logs'");
  console.log('activity_logs table exists in Neon:', r1.rows.length > 0);

  if (r1.rows.length > 0) {
    const cols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='activity_logs' ORDER BY ordinal_position");
    console.log('Columns:');
    cols.rows.forEach(c => console.log(` - ${c.column_name}: ${c.data_type}`));
    const cnt = await pool.query('SELECT COUNT(*) as c FROM activity_logs');
    console.log('Row count:', cnt.rows[0].c);
  }

  // Check if LOCAL db is actually dev.db (critical bug)
  console.log('\n=== DATABASE_URL check ===');
  console.log('DATABASE_URL:', process.env.DATABASE_URL);
  console.log('NEON_DATABASE_URL set:', !!process.env.NEON_DATABASE_URL);

  // Check backend port
  const r3 = await pool.query('SELECT COUNT(*) as c FROM sales WHERE created_at > NOW() - INTERVAL \'1 hour\'');
  console.log('\nSales in last 1 hour in Neon:', r3.rows[0].c);
  
  const r4 = await pool.query('SELECT MAX(created_at) as last_sale FROM sales');
  console.log('Last Neon sale timestamp:', r4.rows[0].last_sale);

  pool.end();
}

run().catch(e => { console.error('Error:', e.message, e.stack); pool.end(); });
