import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('=== Step 1: Consolidating Historical InventoryMovements ===');
    
    // Check how many SALE movements exist
    const saleMovements = await client.query(`
      SELECT 
        to_char(date, 'YYYY-MM') as month,
        product_uuid,
        COUNT(*) as total_rows,
        SUM(quantity) as net_quantity,
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM inventory_movements
      WHERE movement_type = 'SALE'
      GROUP BY to_char(date, 'YYYY-MM'), product_uuid
      ORDER BY month, product_uuid
    `);

    console.log(`Found ${saleMovements.rowCount} product-month groups of SALE movements:`);
    console.table(saleMovements.rows);

    await client.query('BEGIN');

    let seq = 1;
    for (const group of saleMovements.rows) {
      const monthStr = group.month;
      const productUuid = group.product_uuid;
      const netQty = parseFloat(group.net_quantity);

      console.log(`Aggregating SALE movements for product ${productUuid} in month ${monthStr}... (${group.total_rows} rows -> 1 row)`);

      // 1. Insert 1 consolidated inventory movement row
      await client.query(`
        INSERT INTO inventory_movements (
          product_uuid,
          quantity,
          movement_type,
          source,
          reference,
          date,
          created_at,
          device_id,
          local_id
        ) VALUES (
          $1,
          $2,
          'SALE',
          'Point of Sale (Monthly Total)',
          $3,
          $4,
          $5,
          'system-aggregation',
          $6
        )
      `, [
        productUuid,
        netQty,
        `sale-monthly-summary-${monthStr}-${seq}`,
        group.first_date,
        group.last_date,
        seq++
      ]);

      // 2. Delete individual SALE movements for this product and month
      const del = await client.query(`
        DELETE FROM inventory_movements
        WHERE movement_type = 'SALE'
          AND product_uuid = $1
          AND to_char(date, 'YYYY-MM') = $2
          AND (reference NOT LIKE 'sale-monthly-summary-%' OR reference IS NULL)
      `, [productUuid, monthStr]);

      console.log(`Deleted ${del.rowCount} granular SALE movement rows for ${monthStr} (product ${productUuid})`);
    }

    console.log('=== Step 2: Purging cloud_sync_events & processed_event_keys ===');
    
    // Purge cloud_sync_events
    const delCse = await client.query('DELETE FROM cloud_sync_events');
    console.log(`Deleted ${delCse.rowCount} records from cloud_sync_events`);

    // Purge processed_event_keys
    const delPek = await client.query('DELETE FROM processed_event_keys');
    console.log(`Deleted ${delPek.rowCount} records from processed_event_keys`);

    // Reset sync_retention_state watermark if table exists
    const regRes = await client.query("SELECT to_regclass('public.sync_retention_state') as tbl");
    if (regRes.rows[0]?.tbl) {
      await client.query(`
        INSERT INTO sync_retention_state (singleton_id, max_deleted_sequence, updated_at)
        VALUES (1, 0, NOW())
        ON CONFLICT (singleton_id) DO UPDATE SET max_deleted_sequence = 0, updated_at = NOW()
      `);
      console.log('Reset sync_retention_state watermark to 0');
    }

    await client.query('COMMIT');
    console.log('Transaction committed successfully!');

    // Step 3: Run VACUUM FULL to reclaim physical disk space
    console.log('=== Step 3: Running VACUUM FULL ===');
    await client.query('VACUUM FULL inventory_movements');
    await client.query('VACUUM FULL cloud_sync_events');
    await client.query('VACUUM FULL processed_event_keys');
    await client.query('VACUUM FULL sales');
    await client.query('VACUUM FULL sale_items');
    await client.query('VACUUM FULL payments');
    console.log('VACUUM FULL completed successfully!');

    // Step 4: Final Size Stats
    const postStats = await client.query(`
      SELECT relname as table_name,
             pg_size_pretty(pg_total_relation_size(relid)) as total_size,
             n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
    `);
    console.log('=== REMAINING TABLE SIZES ===');
    console.table(postStats.rows);

    const dbSize = await client.query('SELECT pg_size_pretty(pg_database_size(current_database())) as total_db_size');
    console.log('=== NEW TOTAL DATABASE SIZE ===', dbSize.rows[0]);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error during cleanup:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
