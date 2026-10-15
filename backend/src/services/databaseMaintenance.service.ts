import { prisma } from '../config/database';

export interface TechnicalCleanupResult {
  activityLogsPruned: number;
  readNotificationsPruned: number;
  abandonedCartsPruned: number;
  durationMs: number;
  vacuumExecuted: boolean;
  skipped: boolean;
  skipReason?: string;
}

export class DatabaseMaintenanceService {
  private static isRunning = false;

  /**
   * Run daily startup check for technical table maintenance.
   * Ensures technical tables (ActivityLog, Notification, HeldCart) cannot grow unbounded.
   * Runs at most once every 24 hours unless force = true.
   */
  static async runStartupMaintenanceCheck(force = false, db?: any): Promise<TechnicalCleanupResult | null> {
    const client = db || prisma;
    if (this.isRunning) {
      console.log('[DB MAINTENANCE] Maintenance is already in progress. Skipping.');
      return null;
    }

    try {
      const rows: any[] = await client.$queryRawUnsafe(
        `SELECT "lastTechnicalCleanupAt" FROM "CloudSyncSettings" WHERE "id" = 1`
      );
      const settings = rows.length > 0 ? rows[0] : null;
      const now = new Date();

      if (!force && settings?.lastTechnicalCleanupAt) {
        const lastRun = new Date(settings.lastTechnicalCleanupAt).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (now.getTime() - lastRun < oneDayMs) {
          console.log('[DB MAINTENANCE] Technical maintenance ran within the last 24h. Skipping startup check.');
          return {
            activityLogsPruned: 0,
            readNotificationsPruned: 0,
            abandonedCartsPruned: 0,
            durationMs: 0,
            vacuumExecuted: false,
            skipped: true,
            skipReason: 'Ran within 24 hours',
          };
        }
      }

      return await this.performTechnicalCleanup({
        activityLogRetentionDays: 90,
        readNotificationRetentionDays: 30,
        abandonedCartRetentionDays: 3,
        batchSize: 500,
        vacuum: false,
        db: client,
      });
    } catch (err: any) {
      console.error('[DB MAINTENANCE] Error in startup maintenance check:', err.message);
      return null;
    }
  }

  /**
   * Controlled batched cleanup of ephemeral / bounded technical tables.
   */
  static async performTechnicalCleanup(options: {
    activityLogRetentionDays?: number;
    readNotificationRetentionDays?: number;
    abandonedCartRetentionDays?: number;
    batchSize?: number;
    vacuum?: boolean;
    db?: any;
  } = {}): Promise<TechnicalCleanupResult> {
    const client = options.db || prisma;
    if (this.isRunning) {
      throw new Error('Database technical maintenance is already running.');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const batchSize = options.batchSize ?? 500;

    const logCutoff = new Date(Date.now() - (options.activityLogRetentionDays ?? 90) * 24 * 60 * 60 * 1000);
    const notifCutoff = new Date(Date.now() - (options.readNotificationRetentionDays ?? 30) * 24 * 60 * 60 * 1000);
    const cartCutoff = new Date(Date.now() - (options.abandonedCartRetentionDays ?? 3) * 24 * 60 * 60 * 1000);

    let activityLogsPruned = 0;
    let readNotificationsPruned = 0;
    let abandonedCartsPruned = 0;

    try {
      // 1. Controlled batched pruning of ActivityLog (> 90 days old)
      while (true) {
        const batch: any[] = await client.$queryRawUnsafe(
          `SELECT "id" FROM "ActivityLog" WHERE "timestamp" < ? LIMIT ?`,
          logCutoff.toISOString(),
          batchSize
        );
        if (batch.length === 0) break;

        const ids = batch.map((b: any) => b.id);
        const placeholders = ids.map(() => '?').join(',');
        await client.$executeRawUnsafe(
          `DELETE FROM "ActivityLog" WHERE "id" IN (${placeholders})`,
          ...ids
        );
        activityLogsPruned += ids.length;
      }

      // 2. Controlled batched pruning of Read Notifications (> 30 days old)
      // Unread notifications are strictly preserved regardless of age.
      while (true) {
        const batch: any[] = await client.$queryRawUnsafe(
          `SELECT "id" FROM "Notification" WHERE "isRead" = 1 AND "createdAt" < ? LIMIT ?`,
          notifCutoff.toISOString(),
          batchSize
        );
        if (batch.length === 0) break;

        const ids = batch.map((b: any) => b.id);
        const placeholders = ids.map(() => '?').join(',');
        await client.$executeRawUnsafe(
          `DELETE FROM "Notification" WHERE "id" IN (${placeholders})`,
          ...ids
        );
        readNotificationsPruned += ids.length;
      }

      // 3. Controlled batched pruning of Abandoned Held Carts (> 3 days old)
      // Active carts created within 3 days are safely preserved.
      while (true) {
        const batch: any[] = await client.$queryRawUnsafe(
          `SELECT "id" FROM "HeldCart" WHERE "createdAt" < ? LIMIT ?`,
          cartCutoff.toISOString(),
          batchSize
        );
        if (batch.length === 0) break;

        const ids = batch.map((b: any) => b.id);
        const placeholders = ids.map(() => '?').join(',');
        await client.$executeRawUnsafe(
          `DELETE FROM "HeldCart" WHERE "id" IN (${placeholders})`,
          ...ids
        );
        abandonedCartsPruned += ids.length;
      }

      // 4. Update lastTechnicalCleanupAt in CloudSyncSettings
      await client.$executeRawUnsafe(`
        INSERT INTO "CloudSyncSettings" ("id", "syncEnabled", "downstreamEnabled", "updatedAt", "lastTechnicalCleanupAt")
        VALUES (1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT("id") DO UPDATE SET
          "lastTechnicalCleanupAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP;
      `);

      let vacuumExecuted = false;
      if (options.vacuum) {
        await client.$executeRawUnsafe(`PRAGMA incremental_vacuum;`);
        vacuumExecuted = true;
      }

      const durationMs = Date.now() - startTime;
      console.log(
        `[DB MAINTENANCE] Completed technical maintenance in ${durationMs}ms: ` +
        `ActivityLogs pruned: ${activityLogsPruned}, ` +
        `Read notifications pruned: ${readNotificationsPruned}, ` +
        `Abandoned carts pruned: ${abandonedCartsPruned}.`
      );

      return {
        activityLogsPruned,
        readNotificationsPruned,
        abandonedCartsPruned,
        durationMs,
        vacuumExecuted,
        skipped: false,
      };
    } finally {
      this.isRunning = false;
    }
  }
}
