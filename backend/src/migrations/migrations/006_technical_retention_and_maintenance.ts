import { Prisma } from '@prisma/client';
import { Migration } from '../types';

export const migration006TechnicalRetentionAndMaintenance: Migration = {
  version: 6,
  name: 'technical_retention_and_maintenance',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // 1. Inspect existing columns on CloudSyncSettings
    const tableInfo = await tx.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info("CloudSyncSettings")`
    );
    const existingCols = new Set(tableInfo.map((c) => c.name));

    // 2. Add lastTechnicalCleanupAt if missing
    if (!existingCols.has('lastTechnicalCleanupAt')) {
      await tx.$executeRawUnsafe(`
        ALTER TABLE "CloudSyncSettings" 
        ADD COLUMN "lastTechnicalCleanupAt" DATETIME;
      `);
      console.log('[MIGRATION v6] Added lastTechnicalCleanupAt column to CloudSyncSettings.');
    }

    // 3. Ensure singleton settings row exists
    await tx.$executeRawUnsafe(`
      INSERT INTO "CloudSyncSettings" ("id", "syncEnabled", "downstreamEnabled", "updatedAt", "lastTechnicalCleanupAt")
      VALUES (1, 1, 1, CURRENT_TIMESTAMP, NULL)
      ON CONFLICT("id") DO NOTHING;
    `);

    // 4. Ensure optimal indexes for bounded technical tables
    // ActivityLog index on timestamp
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ActivityLog_timestamp_idx" ON "ActivityLog"("timestamp");
    `);

    // Notification index on (isRead, createdAt) for fast bounded pruning
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Notification_isRead_createdAt_idx" ON "Notification"("isRead", "createdAt");
    `);

    // HeldCart index on createdAt for fast expiry of abandoned carts
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "HeldCart_createdAt_idx" ON "HeldCart"("createdAt");
    `);

    console.log('[MIGRATION v6] Technical retention and maintenance migration complete.');
  },
};
