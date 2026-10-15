import { Prisma } from '@prisma/client';
import { Migration } from '../types';

/**
 * Migration 014: High-Performance POS, Khata Ledger, and SyncQueue Indexes
 *
 * Adds targeted covering composite indexes for:
 * 1. Sale: customerId + status + remainingBalance (Eliminates temporary B-tree for Khata ledger aggregations)
 * 2. SyncQueue: status + nextRetryAt + layer (Eliminates full table sorting across 13k+ pending sync items)
 * 3. Sale: customerId + createdAt (Optimizes customer history lookups)
 *
 * Runs ANALYZE so SQLite's query planner immediately recognizes the indexes.
 */
export const migration014PerformanceAndLedgerIndexes: Migration = {
  version: 14,
  name: 'performance_and_ledger_indexes',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // 1. Covering index for Khata ledger balances and open dues aggregations
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_customerId_status_remaining_idx" 
      ON "Sale"("customerId", "status", "remainingBalance");
    `);

    // 2. Customer chronological sales lookup
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_customerId_createdAt_idx" 
      ON "Sale"("customerId", "createdAt");
    `);

    // 3. High-throughput SyncQueue polling index (status, nextRetryAt, layer)
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "SyncQueue_status_nextRetryAt_layer_idx" 
      ON "SyncQueue"("status", "nextRetryAt", "layer");
    `);

    // 4. Update SQLite statistics
    await tx.$executeRawUnsafe(`ANALYZE;`);

    console.log('[MIGRATION v14] Performance and Ledger indexes created successfully.');
  },
};
