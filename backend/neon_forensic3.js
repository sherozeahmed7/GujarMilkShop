const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://gujjarmilkshop_owner:npg_vaCoIJQrKX62@ep-holy-waterfall-b3fzjq2j-pooler.c-4.ap-southeast-1.aws.neon.tech/gujjarmilkshop?sslmode=verify-full' });

async function run() {
  try {
    // inventory_movements schema
    console.log('=== inventory_movements columns ===');
    const mvCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'inventory_movements' ORDER BY ordinal_position");
    mvCols.rows.forEach(c => console.log(JSON.stringify(c)));

    // inventory_movements records
    console.log('\n=== Neon inventory_movements (all) ===');
    const mvs = await pool.query('SELECT * FROM inventory_movements ORDER BY created_at LIMIT 20');
    console.log(JSON.stringify(mvs.rows, null, 2));

    // cloud_sync_events for InventoryMovement (full payload) 
    console.log('\n=== cloud_sync_events InventoryMovement (full) ===');
    const mvEvs = await pool.query("SELECT change_sequence, device_id, entity_type, cloud_uuid, operation, payload FROM cloud_sync_events WHERE entity_type = 'InventoryMovement' ORDER BY change_sequence");
    console.log(JSON.stringify(mvEvs.rows, null, 2));

    // cloud_sync_events change_sequence = 395
    console.log('\n=== cloud_sync_events change_sequence=395 (RAW) ===');
    const ev395 = await pool.query('SELECT * FROM cloud_sync_events WHERE change_sequence = 395');
    console.log('rowCount:', ev395.rowCount);
    console.log(JSON.stringify(ev395.rows, null, 2));

    // What IS at seq 395?
    console.log('\n=== cloud_sync_events range 390-415 ===');
    const range = await pool.query('SELECT change_sequence, device_id, entity_type, cloud_uuid, operation FROM cloud_sync_events WHERE change_sequence BETWEEN 390 AND 415 ORDER BY change_sequence');
    range.rows.forEach(r => console.log(JSON.stringify(r)));

  } catch(e) {
    console.error('FATAL:', e.message);
  } finally {
    await pool.end();
  }
}
run();
