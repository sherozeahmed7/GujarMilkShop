import dotenv from 'dotenv';
dotenv.config();
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });
  const client = await pool.connect();

  try {
    console.log('--- Step 1: Checking current sales & customers in Neon ---');
    const walkInCust = await client.query("SELECT * FROM customers WHERE customer_type = 'walk_in' OR id = '00000000-0000-4000-8000-000000000001'");
    let walkInId = '00000000-0000-4000-8000-000000000001';
    if (walkInCust.rowCount === 0) {
      console.log('Creating canonical walk-in customer...');
      await client.query(`
        INSERT INTO customers (id, local_id, device_id, name, customer_type, status)
        VALUES ($1, 0, 'system-walk-in', 'Walk-In Customer', 'walk_in', 'active')
        ON CONFLICT (id) DO NOTHING
      `, [walkInId]);
    } else {
      walkInId = walkInCust.rows[0].id;
      console.log('Found canonical walk-in customer:', walkInId);
    }

    // Step 2: Compute monthly aggregations for walk-in sales
    const monthlyGroups = await client.query(`
      SELECT 
        to_char(created_at, 'YYYY-MM') as month,
        MIN(created_at) as first_sale_at,
        MAX(created_at) as last_sale_at,
        COUNT(*) as total_sales,
        SUM(total_amount) as sum_total_amount,
        SUM(paid_amount) as sum_paid_amount,
        SUM(remaining_balance) as sum_remaining_balance
      FROM sales
      WHERE sale_type = 'walk_in'
      GROUP BY to_char(created_at, 'YYYY-MM')
      ORDER BY month
    `);

    console.log(`Found ${monthlyGroups.rowCount} monthly groups for walk-in sales:`);
    console.table(monthlyGroups.rows);

    await client.query('BEGIN');

    let itemSeq = 1;
    let paySeq = 1;
    let saleSeq = 1;

    for (const group of monthlyGroups.rows) {
      const monthStr = group.month;
      console.log(`Processing month ${monthStr}... (${group.total_sales} sales)`);

      // 1. Get total sale items by product for this month's walk-in sales
      const itemsSummary = await client.query(`
        SELECT 
          si.item_name,
          SUM(si.quantity) as total_qty,
          SUM(si.total_price) as total_price
        FROM sale_items si
        JOIN sales s ON si.sale_uuid = s.id
        WHERE s.sale_type = 'walk_in' AND to_char(s.created_at, 'YYYY-MM') = $1
        GROUP BY si.item_name
      `, [monthStr]);

      console.log(`Items summary for ${monthStr}:`, itemsSummary.rows);

      // 2. Get total payments by method for this month's walk-in sales
      const paymentsSummary = await client.query(`
        SELECT 
          p.method,
          SUM(p.amount) as total_amount
        FROM payments p
        JOIN sales s ON p.sale_uuid = s.id
        WHERE s.sale_type = 'walk_in' AND to_char(s.created_at, 'YYYY-MM') = $1
        GROUP BY p.method
      `, [monthStr]);

      console.log(`Payments summary for ${monthStr}:`, paymentsSummary.rows);

      // 3. Create the single aggregated Sale row
      const aggSaleRes = await client.query(`
        INSERT INTO sales (
          sale_type,
          customer_uuid,
          customer_name,
          total_amount,
          paid_amount,
          remaining_balance,
          status,
          token_number,
          created_at,
          updated_at,
          device_id,
          local_id
        ) VALUES (
          'walk_in',
          $1,
          $2,
          $3,
          $4,
          $5,
          'paid',
          0,
          $6,
          $7,
          'system-aggregation',
          $8
        ) RETURNING id
      `, [
        walkInId,
        `Walk-In Monthly Total (${monthStr})`,
        parseFloat(group.sum_total_amount),
        parseFloat(group.sum_paid_amount),
        parseFloat(group.sum_remaining_balance),
        group.first_sale_at,
        group.last_sale_at,
        saleSeq++
      ]);

      const aggSaleId = aggSaleRes.rows[0].id;
      console.log(`Created aggregated Sale ${aggSaleId} for month ${monthStr}`);

      // 4. Insert aggregated SaleItems
      for (const item of itemsSummary.rows) {
        const qty = parseFloat(item.total_qty);
        const totalPrice = parseFloat(item.total_price);
        const unitPrice = qty > 0 ? Math.round((totalPrice / qty) * 100) / 100 : 0;

        await client.query(`
          INSERT INTO sale_items (
            sale_uuid,
            item_name,
            quantity,
            unit_price,
            total_price,
            created_at,
            device_id,
            local_id
          ) VALUES ($1, $2, $3, $4, $5, $6, 'system-aggregation', $7)
        `, [
          aggSaleId,
          item.item_name,
          qty,
          unitPrice,
          totalPrice,
          group.first_sale_at,
          itemSeq++
        ]);
      }

      // 5. Insert aggregated Payments
      for (const pay of paymentsSummary.rows) {
        const amount = parseFloat(pay.total_amount);
        await client.query(`
          INSERT INTO payments (
            sale_uuid,
            method,
            amount,
            status,
            created_at,
            device_id,
            local_id
          ) VALUES ($1, $2, $3, 'completed', $4, 'system-aggregation', $5)
        `, [
          aggSaleId,
          pay.method,
          amount,
          group.first_sale_at,
          paySeq++
        ]);
      }

      // 6. Update returns pointing to old sales in this month to point to the new aggregated sale
      const updatedReturns = await client.query(`
        UPDATE returns
        SET sale_uuid = $1
        WHERE sale_uuid IN (
          SELECT id FROM sales
          WHERE sale_type = 'walk_in'
            AND to_char(created_at, 'YYYY-MM') = $2
            AND id != $1
        )
      `, [aggSaleId, monthStr]);
      console.log(`Re-linked ${updatedReturns.rowCount} returns to aggregated sale for ${monthStr}`);

      // 7. Delete individual walk-in sales items & payments
      const delItems = await client.query(`
        DELETE FROM sale_items
        WHERE sale_uuid IN (
          SELECT id FROM sales
          WHERE sale_type = 'walk_in'
            AND to_char(created_at, 'YYYY-MM') = $1
            AND id != $2
        )
      `, [monthStr, aggSaleId]);
      console.log(`Deleted ${delItems.rowCount} old sale_items for ${monthStr}`);

      const delPayments = await client.query(`
        DELETE FROM payments
        WHERE sale_uuid IN (
          SELECT id FROM sales
          WHERE sale_type = 'walk_in'
            AND to_char(created_at, 'YYYY-MM') = $1
            AND id != $2
        )
      `, [monthStr, aggSaleId]);
      console.log(`Deleted ${delPayments.rowCount} old payments for ${monthStr}`);

      const delSales = await client.query(`
        DELETE FROM sales
        WHERE sale_type = 'walk_in'
          AND to_char(created_at, 'YYYY-MM') = $1
          AND id != $2
      `, [monthStr, aggSaleId]);
      console.log(`Deleted ${delSales.rowCount} old individual sales for ${monthStr}`);
    }

    // Step 3: Remove Sale / SaleItem / Payment events from cloud_sync_events to free space
    console.log('--- Step 3: Cleaning old Sale/SaleItem/Payment sync events from cloud_sync_events ---');
    const delEvents = await client.query(`
      DELETE FROM cloud_sync_events
      WHERE entity_type IN ('Sale', 'SaleItem', 'Payment')
    `);
    console.log(`Deleted ${delEvents.rowCount} sync events for Sale/SaleItem/Payment from cloud_sync_events`);

    // Step 4: Drop idempotency_log table
    console.log('--- Step 4: Dropping idempotency_log table ---');
    await client.query(`DROP TABLE IF EXISTS idempotency_log CASCADE`);
    console.log('idempotency_log dropped successfully');

    await client.query('COMMIT');
    console.log('All changes committed successfully!');

    // Step 5: Run VACUUM FULL to actually reclaim disk space from PostgreSQL
    console.log('--- Step 5: Running VACUUM FULL on modified tables ---');
    await client.query('VACUUM FULL sales');
    await client.query('VACUUM FULL sale_items');
    await client.query('VACUUM FULL payments');
    await client.query('VACUUM FULL cloud_sync_events');
    console.log('VACUUM FULL completed');

    // Post check sizes
    const postStats = await client.query(`
      SELECT relname as table_name,
             pg_size_pretty(pg_total_relation_size(relid)) as total_size,
             n_live_tup as row_count
      FROM pg_stat_user_tables
      WHERE relname IN ('cloud_sync_events', 'sales', 'sale_items', 'payments', 'processed_event_keys')
      ORDER BY pg_total_relation_size(relid) DESC
    `);
    console.table(postStats.rows);

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error during aggregation:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(console.error);
