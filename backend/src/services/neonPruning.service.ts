import { getNeonPool } from '../config/neonDb';

/**
 * Prunes Walk-In detail rows older than retentionCutoffDate in small, controlled batches
 * without emitting any cloud_sync_events.
 */
export async function pruneEligibleWalkInDetail(options: {
  retentionDays?: number;
  batchSize?: number;
  dryRun?: boolean;
}) {
  const pool = getNeonPool();
  const retentionDays = options.retentionDays ?? 30;
  const batchSize = options.batchSize ?? 500;
  const dryRun = options.dryRun ?? false;

  console.log(`=== NEON WALK-IN STORAGE PRUNING ENGINE (Retention: ${retentionDays} days, DryRun: ${dryRun}) ===`);
  
  // Cutoff in Asia/Karachi
  const cutoffRes = await pool.query(
    `SELECT ((NOW() AT TIME ZONE 'Asia/Karachi')::date - $1::int)::text AS cutoff_date`,
    [retentionDays]
  );
  const cutoffDate = cutoffRes.rows[0].cutoff_date;
  console.log(`Computed Asia/Karachi Cutoff Date: ${cutoffDate}`);

  // 1. Identify Eligible Walk-In Sales strictly older than cutoffDate
  const eligibleSalesRes = await pool.query(
    `
    SELECT s.id
    FROM sales s
    WHERE s.sale_type = 'walk_in'
      AND (s.created_at AT TIME ZONE 'Asia/Karachi')::date < $1::date
    `,
    [cutoffDate]
  );

  const eligibleSaleUuids = eligibleSalesRes.rows.map((r: any) => r.id);
  console.log(`Found ${eligibleSaleUuids.length} Walk-In sales eligible for pruning (< ${cutoffDate}).`);

  if (eligibleSaleUuids.length === 0) {
    console.log('No Walk-In detail records exceed the retention threshold. Everything is within the safe 30-day window.');
    return {
      cutoffDate,
      eligibleSales: 0,
      prunedSales: 0,
      prunedItems: 0,
      prunedPayments: 0,
      prunedMovements: 0,
    };
  }

  if (dryRun) {
    return {
      cutoffDate,
      eligibleSales: eligibleSaleUuids.length,
      prunedSales: 0,
      prunedItems: 0,
      prunedPayments: 0,
      prunedMovements: 0,
      dryRun: true,
    };
  }

  // 2. Perform Foreign-Key Safe Batched Deletion
  let totalPrunedItems = 0;
  let totalPrunedPayments = 0;
  let totalPrunedSales = 0;

  for (let i = 0; i < eligibleSaleUuids.length; i += batchSize) {
    const batch = eligibleSaleUuids.slice(i, i + batchSize);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete child sale_items
      const itemDel = await client.query(
        `DELETE FROM sale_items WHERE sale_uuid = ANY($1::uuid[])`,
        [batch]
      );
      totalPrunedItems += itemDel.rowCount ?? 0;

      // Delete child payments
      const payDel = await client.query(
        `DELETE FROM payments WHERE sale_uuid = ANY($1::uuid[])`,
        [batch]
      );
      totalPrunedPayments += payDel.rowCount ?? 0;

      // Delete parent sales
      const saleDel = await client.query(
        `DELETE FROM sales WHERE id = ANY($1::uuid[])`,
        [batch]
      );
      totalPrunedSales += saleDel.rowCount ?? 0;

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Pruning batch failed, rolled back:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  return {
    cutoffDate,
    eligibleSales: eligibleSaleUuids.length,
    prunedSales: totalPrunedSales,
    prunedItems: totalPrunedItems,
    prunedPayments: totalPrunedPayments,
    prunedMovements: 0,
  };
}
