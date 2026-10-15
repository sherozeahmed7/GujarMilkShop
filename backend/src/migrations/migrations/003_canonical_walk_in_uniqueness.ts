import { Prisma } from '@prisma/client';
import { Migration } from '../types';
import {
  WALK_IN_CUSTOMER_CLOUD_UUID,
  WALK_IN_CUSTOMER_NAME,
  WALK_IN_CUSTOMER_TYPE,
} from '../../config/walkInCustomer';
import { SyncQueueService } from '../../services/syncQueue.service';
import { getDeviceId } from '../../utils/deviceId';

export const migration003CanonicalWalkInUniqueness: Migration = {
  version: 3,
  name: 'canonical_walk_in_uniqueness',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    const deviceId = getDeviceId();

    // 1. Find all candidates with customerType = 'walk_in' using raw SQL
    // (We use raw SQL to avoid Prisma querying `cloudUuid` which is added in migration v7)
    const walkIns = await tx.$queryRawUnsafe<Array<{ id: number; name: string; customerType: string }>>(`
      SELECT "id", "name", "customerType" FROM "Customer" 
      WHERE "customerType" = '${WALK_IN_CUSTOMER_TYPE}' 
      ORDER BY "id" ASC
    `);

    let canonicalId = walkIns[0]?.id;

    // If none exists, create the canonical record using raw SQL
    if (!canonicalId) {
      await tx.$executeRawUnsafe(`
        INSERT INTO "Customer" ("name", "customerType", "status", "createdAt", "updatedAt")
        VALUES ('${WALK_IN_CUSTOMER_NAME}', '${WALK_IN_CUSTOMER_TYPE}', 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `);
      const created = await tx.$queryRawUnsafe<Array<{ id: number }>>(`
        SELECT "id" FROM "Customer" WHERE "customerType" = '${WALK_IN_CUSTOMER_TYPE}' LIMIT 1
      `);
      canonicalId = created[0].id;
    }

    // Ensure LocalToCloudMapping binds canonical local ID to canonical cloud UUID (if table exists)
    const mappingTableCheck = await tx.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='LocalToCloudMapping'`
    );
    if (mappingTableCheck.length > 0) {
      await tx.$executeRawUnsafe(`
        INSERT INTO "LocalToCloudMapping" ("deviceId", "entityType", "localId", "cloudUuid", "createdAt", "updatedAt")
        VALUES (?, 'Customer', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT("deviceId", "entityType", "localId") DO UPDATE SET
          "cloudUuid" = excluded."cloudUuid",
          "updatedAt" = CURRENT_TIMESTAMP
      `, deviceId, canonicalId, WALK_IN_CUSTOMER_CLOUD_UUID);
    }

    const duplicateWalkIns = walkIns.slice(1);
    const duplicateIds = duplicateWalkIns.map((d) => d.id);

    // 2. Re-point any orphaned or duplicate walk-in sales to the canonical record
    if (duplicateIds.length > 0) {
      const dupList = duplicateIds.join(',');
      await tx.$executeRawUnsafe(`
        UPDATE "Sale"
        SET "customerId" = ${canonicalId}
        WHERE ("saleType" = 'walk_in' AND "customerId" IS NULL)
           OR "customerId" IN (${dupList})
      `);
    } else {
      await tx.$executeRawUnsafe(`
        UPDATE "Sale"
        SET "customerId" = ${canonicalId}
        WHERE "saleType" = 'walk_in' AND "customerId" IS NULL
      `);
    }

    // 3. Safely remove duplicate Walk-In customer records and duplicate mappings
    if (duplicateIds.length > 0) {
      const dupList = duplicateIds.join(',');
      if (mappingTableCheck.length > 0) {
        await tx.$executeRawUnsafe(`
          DELETE FROM "LocalToCloudMapping"
          WHERE "entityType" = 'Customer' AND "localId" IN (${dupList})
        `);
      }

      await tx.$executeRawUnsafe(`
        DELETE FROM "Customer"
        WHERE "id" IN (${dupList})
      `);
    }

    // 4. Create database-level partial unique index for exactly ONE walk_in customer
    await tx.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Customer_single_walk_in_key" 
      ON "Customer"("customerType") 
      WHERE "customerType" = 'walk_in'
    `);
  },
};
