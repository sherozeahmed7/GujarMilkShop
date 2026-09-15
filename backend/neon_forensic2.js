const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://gujjarmilkshop_owner:npg_vaCoIJQrKX62@ep-holy-waterfall-b3fzjq2j-pooler.c-4.ap-southeast-1.aws.neon.tech/gujjarmilkshop?sslmode=verify-full' });

async function run() {
  try {
    // 1. cloud_sync_events for change_sequence = 395
    console.log('\n=== cloud_sync_events change_sequence=395 ===');
    const ev395 = await pool.query('SELECT * FROM cloud_sync_events WHERE change_sequence = 395');
    console.log('rowCount:', ev395.rowCount);
    console.log(JSON.stringify(ev395.rows, null, 2));

    // 2. ALL cloud_sync_events ordered
    console.log('\n=== ALL cloud_sync_events (change_sequence ASC) ===');
    const allEvs = await pool.query('SELECT change_sequence, device_id, entity_type, cloud_uuid, operation FROM cloud_sync_events ORDER BY change_sequence ASC');
    allEvs.rows.forEach(r => console.log(JSON.stringify(r)));

    // 3. cloud_sync_events for InventoryProduct
    console.log('\n=== cloud_sync_events WHERE entity_type=InventoryProduct ===');
    const ipEvs = await pool.query("SELECT change_sequence, device_id, entity_type, cloud_uuid, operation, payload FROM cloud_sync_events WHERE entity_type = 'InventoryProduct' ORDER BY change_sequence");
    ipEvs.rows.forEach(r => {
      const p = r.payload || {};
      console.log(`seq=${r.change_sequence} op=${r.operation} uuid=${r.cloud_uuid} device=${r.device_id} code=${p.code} local_id=${p.local_id}`);
    });

    // 4. cloud_sync_events for InventoryMovement
    console.log('\n=== cloud_sync_events WHERE entity_type=InventoryMovement (full payload) ===');
    const mvEvs = await pool.query("SELECT change_sequence, device_id, entity_type, cloud_uuid, operation, payload FROM cloud_sync_events WHERE entity_type = 'InventoryMovement' ORDER BY change_sequence");
    console.log(JSON.stringify(mvEvs.rows, null, 2));

    // 5. cloud_sync_events for specific product UUIDs
    console.log('\n=== cloud_sync_events for product UUIDs 23a28000 and 2ec3016f ===');
    const prodEvs = await pool.query("SELECT change_sequence, device_id, entity_type, cloud_uuid, operation FROM cloud_sync_events WHERE cloud_uuid IN ('23a28000-fad2-41ff-99af-5a90ab525aa1', '2ec3016f-a702-451b-a248-9304c7e71c1b') ORDER BY change_sequence");
    console.log(JSON.stringify(prodEvs.rows, null, 2));

    // 6. cloud_sync_events for Shift conflict UUIDs
    console.log('\n=== cloud_sync_events for Shift conflict UUIDs ===');
    const shiftEvs = await pool.query("SELECT change_sequence, device_id, entity_type, cloud_uuid, operation, payload FROM cloud_sync_events WHERE cloud_uuid IN ('b875e9a7-a45a-44f7-8d7e-a556d4246953','a3d1640f-7a66-4601-be8b-5ce48acf384d','b5f0eb5d-5818-4fd6-a058-60a458316294') ORDER BY change_sequence");
    console.log(JSON.stringify(shiftEvs.rows, null, 2));

    // 7. cloud_sync_events for Shift
    console.log('\n=== cloud_sync_events WHERE entity_type=Shift ===');
    const shiftAllEvs = await pool.query("SELECT change_sequence, device_id, entity_type, cloud_uuid, operation, payload FROM cloud_sync_events WHERE entity_type = 'Shift' ORDER BY change_sequence");
    shiftAllEvs.rows.forEach(r => {
      const p = r.payload || {};
      console.log(`seq=${r.change_sequence} op=${r.operation} uuid=${r.cloud_uuid} device=${r.device_id} shift_date=${p.shift_date} local_id=${p.local_id}`);
    });

    // 8. Neon shifts table
    console.log('\n=== ALL Neon shifts (ordered by created_at) ===');
    const allShifts = await pool.query('SELECT id, device_id, local_id, shift_date, status FROM shifts ORDER BY created_at');
    console.log(JSON.stringify(allShifts.rows, null, 2));

    // 9. supplier_payments columns
    console.log('\n=== Neon supplier_payments columns ===');
    const spCols = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'supplier_payments' ORDER BY ordinal_position");
    spCols.rows.forEach(c => console.log(JSON.stringify(c)));

    // 10. cloud_sync_events for SupplierPayment
    console.log('\n=== cloud_sync_events WHERE entity_type=SupplierPayment ===');
    const spEvs = await pool.query("SELECT change_sequence, device_id, entity_type, cloud_uuid, operation, payload FROM cloud_sync_events WHERE entity_type = 'SupplierPayment' ORDER BY change_sequence");
    console.log(JSON.stringify(spEvs.rows, null, 2));

    // 11. cloud_sync_events for Supplier
    console.log('\n=== cloud_sync_events WHERE entity_type=Supplier ===');
    const supEvs = await pool.query("SELECT change_sequence, device_id, entity_type, cloud_uuid, operation, payload FROM cloud_sync_events WHERE entity_type = 'Supplier' ORDER BY change_sequence");
    supEvs.rows.forEach(r => {
      const p = r.payload || {};
      console.log(`seq=${r.change_sequence} op=${r.operation} uuid=${r.cloud_uuid} name=${p.name}`);
    });

    // 12. Neon suppliers
    console.log('\n=== Neon suppliers ===');
    const sups = await pool.query('SELECT id, device_id, local_id, name FROM suppliers ORDER BY created_at');
    console.log(JSON.stringify(sups.rows, null, 2));

    // 13. ALL tables in Neon
    console.log('\n=== Neon tables ===');
    const tables = await pool.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    tables.rows.forEach(t => console.log(t.tablename));

    // 14. Inventory movements in Neon
    console.log('\n=== Neon inventory_movements (all) ===');
    const mvs = await pool.query('SELECT id, device_id, local_id, product_id, quantity, movement_type, created_at FROM inventory_movements ORDER BY created_at LIMIT 20');
    console.log(JSON.stringify(mvs.rows, null, 2));

  } catch(e) {
    console.error('FATAL:', e.message, e.stack);
  } finally {
    await pool.end();
  }
}
run();
