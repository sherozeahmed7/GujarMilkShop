import { Prisma } from '@prisma/client';
import { Migration } from '../types';
import crypto from 'crypto';
import { WALK_IN_CUSTOMER_CLOUD_UUID } from '../../config/walkInCustomer';

const SYNCABLE_TABLES = [
  'User',
  'Supplier',
  'InventoryProduct',
  'DailyRate',
  'Customer',
  'Shift',
  'SupplierCollection',
  'SupplierPayment',
  'Sale',
  'SaleItem',
  'Payment',
  'Expense',
  'ExpensePayment',
  'InventoryMovement',
  'ButterGheeConversion',
  'MilkProductDailyStock',
  'Return',
  'ReturnItem',
  'AuditRecord',
  'CashPerson',
  'CashbookTransaction',
  'ActivityLog',
];

/** Generate a v4 UUID string in Node.js */
function newUuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
}

export const migration007AddCloudUuidAndBackfill: Migration = {
  version: 7,
  name: 'add_cloud_uuid_and_backfill',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    console.log('[MIGRATION v7] Adding cloudUuid columns and unique indexes to syncable tables...');

    // 1. Ensure temp mapping index exists for fast subquery joins
    const mappingTableCheck = await tx.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='LocalToCloudMapping'`
    );

    if (mappingTableCheck.length > 0) {
      await tx.$executeRawUnsafe(`
        CREATE INDEX IF NOT EXISTS "temp_idx_ltcm_entity_local" ON "LocalToCloudMapping"("entityType", "localId");
      `);
    }

    for (const table of SYNCABLE_TABLES) {
      // 1. Check if column already exists
      const tableInfo = await tx.$queryRawUnsafe<Array<{ name: string }>>(
        `PRAGMA table_info("${table}")`
      );
      const cols = new Set(tableInfo.map((c) => c.name));

      if (!cols.has('cloudUuid')) {
        await tx.$executeRawUnsafe(`
          ALTER TABLE "${table}" ADD COLUMN "cloudUuid" TEXT;
        `);
        console.log(`[MIGRATION v7] Added cloudUuid column to ${table}`);
      }

      // 2. Deterministic backfill from LocalToCloudMapping
      if (mappingTableCheck.length > 0) {
        if (table === 'Customer') {
          // Explicitly assign canonical Walk-In cloudUuid to walk_in customer
          await tx.$executeRawUnsafe(`
            UPDATE "Customer"
            SET "cloudUuid" = ?
            WHERE "customerType" = 'walk_in' AND ("cloudUuid" IS NULL OR "cloudUuid" != ?)
          `, WALK_IN_CUSTOMER_CLOUD_UUID, WALK_IN_CUSTOMER_CLOUD_UUID);
        }

        // Fast correlated update — only sets NULL rows that have a mapping entry
        await tx.$executeRawUnsafe(`
          UPDATE "${table}"
          SET "cloudUuid" = (
            SELECT m."cloudUuid"
            FROM "LocalToCloudMapping" m
            WHERE m."entityType" = '${table}' AND m."localId" = "${table}"."id"
            ORDER BY m."id" DESC
            LIMIT 1
          )
          WHERE "cloudUuid" IS NULL
            AND "${table}"."id" IN (
              SELECT m2."localId" FROM "LocalToCloudMapping" m2 WHERE m2."entityType" = '${table}'
            );
        `);
      }

      // 3. For any unmapped local records, assign UUIDs via SQLite randomblob.
      //    Run per-row by using a correlated subquery with rowid to guarantee uniqueness.
      await tx.$executeRawUnsafe(`
        UPDATE "${table}"
        SET "cloudUuid" = (
          lower(hex(randomblob(4))) || '-' ||
          lower(hex(randomblob(2))) || '-4' ||
          substr(lower(hex(randomblob(2))), 2) || '-a' ||
          substr(lower(hex(randomblob(2))), 2) || '-' ||
          lower(hex(randomblob(6)))
        )
        WHERE "cloudUuid" IS NULL;
      `);

      // 4. Deduplicate: if multiple rows ended up with the same cloudUuid (can happen
      //    when LocalToCloudMapping had duplicate entries, or randomblob collision on
      //    older SQLite), reassign fresh UUIDs to all but the first occurrence.
      //    We identify duplicates by keeping the row with the lowest rowid.
      const duplicates = await tx.$queryRawUnsafe<Array<{ id: number }>>(
        `SELECT "id" FROM "${table}"
         WHERE "cloudUuid" IN (
           SELECT "cloudUuid" FROM "${table}"
           GROUP BY "cloudUuid"
           HAVING COUNT(*) > 1
         )
         AND "rowid" NOT IN (
           SELECT MIN("rowid") FROM "${table}"
           GROUP BY "cloudUuid"
         )`
      );

      if (duplicates.length > 0) {
        console.log(`[MIGRATION v7] Deduplicating ${duplicates.length} cloudUuid collision(s) in ${table}`);
        for (const row of duplicates) {
          const freshUuid = newUuid();
          await tx.$executeRawUnsafe(
            `UPDATE "${table}" SET "cloudUuid" = ? WHERE "id" = ?`,
            freshUuid,
            row.id
          );
        }
      }

      // 5. Create unique index — safe now that duplicates are resolved
      await tx.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "${table}_cloudUuid_key" ON "${table}"("cloudUuid");
      `);
    }

    if (mappingTableCheck.length > 0) {
      await tx.$executeRawUnsafe(`DROP INDEX IF EXISTS "temp_idx_ltcm_entity_local";`);
    }

    console.log('[MIGRATION v7] Finished adding cloudUuid columns and backfilling identities.');
  },
};

