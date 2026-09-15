const { Pool } = require('pg');

const NEON_URL = 'postgresql://gujjarmilkshop_owner:npg_vaCoIJQrKX62@ep-holy-waterfall-b3fzjq2j-pooler.c-4.ap-southeast-1.aws.neon.tech/gujjarmilkshop?sslmode=verify-full';

async function run() {
  const pool = new Pool({ connectionString: NEON_URL });
  try {
    // 1. Neon InventoryProduct 23a28000...
    console.log('\n=== Neon InventoryProduct - 23a28000-fad2-41ff-99af-5a90ab525aa1 ===');
    const ip23 = await pool.query(
      "SELECT id, device_id, local_id, code, name, unit, created_at FROM inventory_products WHERE id = '23a28000-fad2-41ff-99af-5a90ab525aa1'"
    );
    console.log(JSON.stringify(ip23.rows, null, 2));

    // 2. Neon InventoryProduct 2ec3016f...
    console.log('\n=== Neon InventoryProduct - 2ec3016f-a702-451b-a248-9304c7e71c1b ===');
    const ip2e = await pool.query(
      "SELECT id, device_id, local_id, code, name, unit, created_at FROM inventory_products WHERE id = '2ec3016f-a702-451b-a248-9304c7e71c1b'"
    );
    console.log(JSON.stringify(ip2e.rows, null, 2));

    // 3. ALL Neon InventoryProducts with code MILK
    console.log("\n=== Neon InventoryProducts WHERE code='MILK' ===");
    const milkNeon = await pool.query(
      "SELECT id, device_id, local_id, code, name, unit, created_at FROM inventory_products WHERE code = 'MILK' ORDER BY created_at"
    );
    console.log('Count:', milkNeon.rowCount);
    console.log(JSON.stringify(milkNeon.rows, null, 2));

    // 4. ALL Neon InventoryProducts (for full picture)
    console.log('\n=== ALL Neon inventory_products (ordered by created_at) ===');
    const allIp = await pool.query(
      "SELECT id, device_id, local_id, code, name, unit, created_at FROM inventory_products ORDER BY created_at"
    );
    console.log('Total:', allIp.rowCount);
    allIp.rows.forEach(r => console.log(JSON.stringify(r)));

    // 5. cloud_sync_events seq 395 - FULL payload
    console.log('\n=== cloud_sync_events seq 395 - FULL ===');
    const ev395 = await pool.query(
      'SELECT sequence_number, entity_type, change_type, entity_uuid, local_id, device_id, payload, created_at FROM cloud_sync_events WHERE sequence_number = 395'
    );
    console.log(JSON.stringify(ev395.rows, null, 2));

    // 6. CREATE events for both product UUIDs
    console.log('\n=== cloud_sync_events CREATE for both product UUIDs ===');
    const createEvs = await pool.query(`
      SELECT sequence_number, entity_type, change_type, entity_uuid, local_id, device_id, payload, created_at
      FROM cloud_sync_events
      WHERE entity_type = 'InventoryProduct'
        AND entity_uuid IN ('23a28000-fad2-41ff-99af-5a90ab525aa1', '2ec3016f-a702-451b-a248-9304c7e71c1b')
      ORDER BY sequence_number
    `);
    console.log(JSON.stringify(createEvs.rows, null, 2));

    // 7. ALL InventoryProduct events in order
    console.log('\n=== ALL InventoryProduct cloud_sync_events ===');
    const allIpEvs = await pool.query(`
      SELECT sequence_number, change_type, entity_uuid, local_id, device_id, created_at
      FROM cloud_sync_events
      WHERE entity_type = 'InventoryProduct'
      ORDER BY sequence_number
    `);
    allIpEvs.rows.forEach(r => console.log(JSON.stringify(r)));

    // 8. Events surrounding seq 395 (380-420)
    console.log('\n=== cloud_sync_events seqs 380-420 ===');
    const surrounding = await pool.query(`
      SELECT sequence_number, entity_type, change_type, entity_uuid, local_id, device_id
      FROM cloud_sync_events
      WHERE sequence_number BETWEEN 380 AND 420
      ORDER BY sequence_number
    `);
    surrounding.rows.forEach(r => console.log(JSON.stringify(r)));

    // 9. InventoryMovement events near seq 395 (FULL payload)
    console.log('\n=== InventoryMovement cloud_sync_events near seq 395 (FULL payload) ===');
    const mvEvs = await pool.query(`
      SELECT sequence_number, entity_type, change_type, entity_uuid, local_id, device_id, payload
      FROM cloud_sync_events
      WHERE entity_type = 'InventoryMovement'
        AND sequence_number BETWEEN 380 AND 430
      ORDER BY sequence_number
    `);
    console.log(JSON.stringify(mvEvs.rows, null, 2));

    // 10. Shift conflict UUIDs in Neon
    console.log('\n=== Neon shifts for conflict UUIDs ===');
    const conflictShifts = await pool.query(`
      SELECT id, device_id, local_id, shift_date, status, total_sales, created_at
      FROM shifts
      WHERE id IN (
        'b875e9a7-a45a-44f7-8d7e-a556d4246953',
        'a3d1640f-7a66-4601-be8b-5ce48acf384d',
        'b5f0eb5d-5818-4fd6-a058-60a458316294'
      )
    `);
    console.log(JSON.stringify(conflictShifts.rows, null, 2));

    // 11. ALL shifts in Neon ordered by created_at
    console.log('\n=== ALL Neon shifts ===');
    const allShifts = await pool.query(
      'SELECT id, device_id, local_id, shift_date, status FROM shifts ORDER BY created_at DESC LIMIT 15'
    );
    allShifts.rows.forEach(r => console.log(JSON.stringify(r)));

    // 12. cloud_sync_events for conflict shift UUIDs
    console.log('\n=== cloud_sync_events for conflict shift UUIDs ===');
    const shiftEvs = await pool.query(`
      SELECT sequence_number, entity_type, change_type, entity_uuid, local_id, device_id, payload
      FROM cloud_sync_events
      WHERE entity_uuid IN (
        'b875e9a7-a45a-44f7-8d7e-a556d4246953',
        'a3d1640f-7a66-4601-be8b-5ce48acf384d',
        'b5f0eb5d-5818-4fd6-a058-60a458316294'
      )
      ORDER BY sequence_number
    `);
    console.log(JSON.stringify(shiftEvs.rows, null, 2));

    // 13. supplier_payments columns
    console.log('\n=== Neon supplier_payments columns ===');
    const spCols = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'supplier_payments'
      ORDER BY ordinal_position
    `);
    spCols.rows.forEach(c => console.log(JSON.stringify(c)));

    // 14. downstream_sync_cursor
    console.log('\n=== Neon downstream_sync_cursor ===');
    try {
      const cursor = await pool.query('SELECT * FROM downstream_sync_cursor');
      console.log(JSON.stringify(cursor.rows, null, 2));
    } catch(e) {
      console.log('No downstream_sync_cursor table:', e.message);
    }

    // 15. InventoryMovement in Neon referencing each product
    console.log('\n=== Neon inventory_movements referencing 23a28000 or 2ec3016f ===');
    const mvs = await pool.query(`
      SELECT id, device_id, local_id, product_id, quantity, movement_type, created_at
      FROM inventory_movements
      WHERE product_id IN ('23a28000-fad2-41ff-99af-5a90ab525aa1', '2ec3016f-a702-451b-a248-9304c7e71c1b')
      ORDER BY created_at
    `);
    console.log('Count:', mvs.rowCount);
    console.log(JSON.stringify(mvs.rows, null, 2));

    // 16. cloud_sync_events for entity_uuid of seq 395 movement
    // (will get from ev395.rows[0].entity_uuid)
    if (ev395.rows.length > 0) {
      const movementUuid = ev395.rows[0].entity_uuid;
      const productUuidInPayload = ev395.rows[0].payload?.product_uuid || ev395.rows[0].payload?.productUuid || 'N/A';
      console.log('\n=== Summary from seq 395 ===');
      console.log('Movement UUID:', movementUuid);
      console.log('Product UUID in payload:', productUuidInPayload);
      console.log('device_id:', ev395.rows[0].device_id);
      console.log('local_id:', ev395.rows[0].local_id);
    }

  } catch(e) {
    console.error('FATAL:', e.message);
  } finally {
    await pool.end();
  }
}
run();
