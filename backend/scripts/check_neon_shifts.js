const { Pool } = require('pg');
require('dotenv').config();
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function check() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT event_uuid, device_id, entity_type, cloud_uuid, operation, created_at FROM cloud_sync_events WHERE entity_type='Shift' ORDER BY created_at ASC");
    console.log('=== NEON CLOUD SYNC EVENTS FOR SHIFT (' + res.rows.length + ') ===');
    console.log(JSON.stringify(res.rows, null, 2));

    const shifts = await client.query('SELECT * FROM shifts ORDER BY shift_date ASC');
    console.log('=== NEON SHIFTS TABLE (' + shifts.rows.length + ') ===');
    console.log(JSON.stringify(shifts.rows, null, 2));

    // Check users in Neon
    const users = await client.query('SELECT id, device_id, local_id, name, email FROM users');
    console.log('=== NEON USERS TABLE (' + users.rows.length + ') ===');
    console.log(JSON.stringify(users.rows, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    client.release();
    await pool.end();
  }
}
check();
