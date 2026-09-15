const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://gujjarmilkshop_owner:npg_vaCoIJQrKX62@ep-holy-waterfall-b3fzjq2j-pooler.c-4.ap-southeast-1.aws.neon.tech/gujjarmilkshop?sslmode=verify-full' });

async function run() {
  try {
    // Get cloud_sync_events schema
    console.log('=== cloud_sync_events columns ===');
    const schema = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'cloud_sync_events' ORDER BY ordinal_position");
    schema.rows.forEach(c => console.log(JSON.stringify(c)));

    // Get a sample row to understand actual column names
    console.log('\n=== cloud_sync_events sample row ===');
    const sample = await pool.query("SELECT * FROM cloud_sync_events LIMIT 1");
    console.log(JSON.stringify(sample.rows[0], null, 2));

    // Get total count
    const cnt = await pool.query("SELECT COUNT(*) FROM cloud_sync_events");
    console.log('\nTotal cloud_sync_events:', cnt.rows[0].count);

  } catch(e) {
    console.error('ERROR:', e.message);
  } finally {
    await pool.end();
  }
}
run();
