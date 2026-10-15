import { Prisma } from '@prisma/client';
import { Migration } from '../types';

export const migration004SyncSettingsRetentionTracking: Migration = {
  version: 4,
  name: 'sync_settings_retention_tracking',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // 1. Inspect existing columns on CloudSyncSettings
    const tableInfo = await tx.$queryRawUnsafe<Array<{ name: string }>>(
      `PRAGMA table_info("CloudSyncSettings")`
    );
    const existingCols = new Set(tableInfo.map((c) => c.name));

    // 2. Add lastSuccessfulUpstreamSyncAt if missing
    if (!existingCols.has('lastSuccessfulUpstreamSyncAt')) {
      await tx.$executeRawUnsafe(`
        ALTER TABLE "CloudSyncSettings" 
        ADD COLUMN "lastSuccessfulUpstreamSyncAt" DATETIME;
      `);
    }

    // 3. Add lastLocalSyncCleanupAt if missing
    if (!existingCols.has('lastLocalSyncCleanupAt')) {
      await tx.$executeRawUnsafe(`
        ALTER TABLE "CloudSyncSettings" 
        ADD COLUMN "lastLocalSyncCleanupAt" DATETIME;
      `);
    }

    // 4. Backfill lastSuccessfulUpstreamSyncAt from latest SYNCED SyncQueue record if available
    const lastSynced = await tx.syncQueue.findFirst({
      where: { status: 'SYNCED' },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    const lastSyncDate = lastSynced?.updatedAt || new Date();

    // Ensure row id=1 exists and has the timestamp
    await tx.$executeRawUnsafe(`
      INSERT INTO "CloudSyncSettings" ("id", "syncEnabled", "downstreamEnabled", "updatedAt", "lastSuccessfulUpstreamSyncAt", "lastLocalSyncCleanupAt")
      VALUES (1, 1, 1, CURRENT_TIMESTAMP, ?, NULL)
      ON CONFLICT("id") DO UPDATE SET
        "lastSuccessfulUpstreamSyncAt" = COALESCE("CloudSyncSettings"."lastSuccessfulUpstreamSyncAt", excluded."lastSuccessfulUpstreamSyncAt")
    `, lastSyncDate);
  },
};
