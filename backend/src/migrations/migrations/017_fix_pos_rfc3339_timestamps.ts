import { Prisma } from '@prisma/client';
import { Migration } from '../types';

/**
 * Migration 017: Fix POS RFC3339 Timestamp Format
 *
 * ROOT CAUSE: Rust's `save_pos_sale` stored `createdAt`/`updatedAt` as RFC3339
 * strings (e.g. "2026-10-17T22:49:01.653987700+00:00"), but Prisma stores
 * DateTime fields as Unix millisecond integers.
 *
 * When Prisma runs `WHERE createdAt >= ?` with an integer bound, SQLite's
 * type affinity rules cause string values to compare as greater than any
 * integer, so all RFC3339-stored sales are invisible to date-range queries.
 *
 * This migration converts every RFC3339 createdAt/updatedAt in:
 *   - Sale
 *   - SaleItem
 *   - Payment
 *   - MilkProductDailyStock
 *   - InventoryMovement
 *   - SyncQueue
 *   - Customer (where applicable)
 *
 * into Unix millisecond integers, fixing the Dashboard, Sales Report,
 * Profit & Loss, Customer Report, and F2 data visibility permanently.
 *
 * The conversion uses SQLite's strftime('%s', ...) * 1000 which handles
 * both ISO-8601 (T separator, +00:00 offset) and plain datetime strings.
 */
export const migration017FixPosRfc3339Timestamps: Migration = {
  version: 17,
  name: 'fix_pos_rfc3339_timestamps',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // Helper: only update rows where createdAt is a non-numeric string
    // (typeof check via CAST: if CAST(createdAt AS INTEGER) = 0 AND createdAt != '0' it's a string)

    // --- Sale ---
    await tx.$executeRawUnsafe(`
      UPDATE "Sale"
      SET
        "createdAt" = CAST(
          (strftime('%s', substr("createdAt", 1, 23)) * 1000
           + CAST(substr("createdAt", 21, 3) AS INTEGER))
          AS INTEGER
        ),
        "updatedAt" = CAST(
          (strftime('%s', substr("updatedAt", 1, 23)) * 1000
           + CAST(substr("updatedAt", 21, 3) AS INTEGER))
          AS INTEGER
        )
      WHERE typeof("createdAt") = 'text'
        AND "createdAt" LIKE '____-__-__%'
    `);
    console.log('[MIGRATION v17] Sale timestamps converted to Unix ms.');

    // --- SaleItem ---
    await tx.$executeRawUnsafe(`
      UPDATE "SaleItem"
      SET
        "createdAt" = CAST(
          (strftime('%s', substr("createdAt", 1, 23)) * 1000
           + CAST(substr("createdAt", 21, 3) AS INTEGER))
          AS INTEGER
        )
      WHERE typeof("createdAt") = 'text'
        AND "createdAt" LIKE '____-__-__%'
    `);
    console.log('[MIGRATION v17] SaleItem timestamps converted to Unix ms.');

    // --- Payment ---
    await tx.$executeRawUnsafe(`
      UPDATE "Payment"
      SET
        "createdAt" = CAST(
          (strftime('%s', substr("createdAt", 1, 23)) * 1000
           + CAST(substr("createdAt", 21, 3) AS INTEGER))
          AS INTEGER
        )
      WHERE typeof("createdAt") = 'text'
        AND "createdAt" LIKE '____-__-__%'
    `);
    console.log('[MIGRATION v17] Payment timestamps converted to Unix ms.');

    // --- MilkProductDailyStock ---
    await tx.$executeRawUnsafe(`
      UPDATE "MilkProductDailyStock"
      SET
        "createdAt" = CAST(
          (strftime('%s', substr("createdAt", 1, 23)) * 1000
           + CAST(substr("createdAt", 21, 3) AS INTEGER))
          AS INTEGER
        ),
        "updatedAt" = CAST(
          (strftime('%s', substr("updatedAt", 1, 23)) * 1000
           + CAST(substr("updatedAt", 21, 3) AS INTEGER))
          AS INTEGER
        )
      WHERE typeof("createdAt") = 'text'
        AND "createdAt" LIKE '____-__-__%'
    `);
    console.log('[MIGRATION v17] MilkProductDailyStock timestamps converted to Unix ms.');

    // --- InventoryMovement (date column uses plain date string; leave it; only createdAt) ---
    await tx.$executeRawUnsafe(`
      UPDATE "InventoryMovement"
      SET
        "createdAt" = CAST(
          (strftime('%s', substr("createdAt", 1, 23)) * 1000
           + CAST(substr("createdAt", 21, 3) AS INTEGER))
          AS INTEGER
        )
      WHERE typeof("createdAt") = 'text'
        AND "createdAt" LIKE '____-__-__%'
    `);
    console.log('[MIGRATION v17] InventoryMovement timestamps converted to Unix ms.');

    // --- SyncQueue ---
    await tx.$executeRawUnsafe(`
      UPDATE "SyncQueue"
      SET
        "createdAt" = CAST(
          (strftime('%s', substr("createdAt", 1, 23)) * 1000
           + CAST(substr("createdAt", 21, 3) AS INTEGER))
          AS INTEGER
        ),
        "updatedAt" = CAST(
          (strftime('%s', substr("updatedAt", 1, 23)) * 1000
           + CAST(substr("updatedAt", 21, 3) AS INTEGER))
          AS INTEGER
        )
      WHERE typeof("createdAt") = 'text'
        AND "createdAt" LIKE '____-__-__%'
    `);
    console.log('[MIGRATION v17] SyncQueue timestamps converted to Unix ms.');

    // --- Customer (walk-in entries that might have RFC3339 createdAt) ---
    await tx.$executeRawUnsafe(`
      UPDATE "Customer"
      SET
        "createdAt" = CAST(
          (strftime('%s', substr("createdAt", 1, 23)) * 1000
           + CAST(substr("createdAt", 21, 3) AS INTEGER))
          AS INTEGER
        ),
        "updatedAt" = CAST(
          (strftime('%s', substr("updatedAt", 1, 23)) * 1000
           + CAST(substr("updatedAt", 21, 3) AS INTEGER))
          AS INTEGER
        )
      WHERE typeof("createdAt") = 'text'
        AND "createdAt" LIKE '____-__-__%'
    `);
    console.log('[MIGRATION v17] Customer timestamps converted to Unix ms.');

    await tx.$executeRawUnsafe(`ANALYZE;`);
    console.log('[MIGRATION v17] RFC3339 → Unix ms timestamp fix applied successfully. Dashboard and reports will now show POS sales correctly.');
  },
};
