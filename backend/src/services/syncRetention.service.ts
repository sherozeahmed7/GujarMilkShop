import { prisma } from '../config/database';

export interface CleanupResult {
  prunedCount: number;
  remainingSynced: number;
  pendingCount: number;
  failedCount: number;
  durationMs: number;
  vacuumExecuted: boolean;
  skipped: boolean;
  skipReason?: string;
}

export class SyncRetentionService {
  private static isRunning = false;

  /**
   * Run startup retention check.
   * Only executes once every 24 hours unless force = true.
   */
  static async runStartupRetentionCheck(force = false): Promise<CleanupResult | null> {
    if (this.isRunning) {
      console.log('[SYNC RETENTION] Retention cleanup is already in progress. Skipping.');
      return null;
    }

    try {
      const settings = await prisma.cloudSyncSettings.findUnique({ where: { id: 1 } });
      const now = new Date();

      if (!force && settings?.lastLocalSyncCleanupAt) {
        const lastRun = new Date(settings.lastLocalSyncCleanupAt).getTime();
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (now.getTime() - lastRun < oneDayMs) {
          console.log('[SYNC RETENTION] Cleanup ran within the last 24h. Skipping startup retention check.');
          return {
            prunedCount: 0,
            remainingSynced: await prisma.syncQueue.count({ where: { status: 'SYNCED' } }),
            pendingCount: await prisma.syncQueue.count({ where: { status: 'PENDING' } }),
            failedCount: await prisma.syncQueue.count({ where: { status: 'FAILED' } }),
            durationMs: 0,
            vacuumExecuted: false,
            skipped: true,
            skipReason: 'Ran within 24 hours',
          };
        }
      }

      return await this.pruneSyncedHistory({ daysThreshold: 7, batchSize: 500, vacuum: false });
    } catch (err: any) {
      console.error('[SYNC RETENTION] Error in startup retention check:', err.message);
      return null;
    }
  }

  /**
   * Controlled batched pruning of SYNCED rows older than `daysThreshold`.
   * Preserves PENDING, FAILED, and SYNCING records strictly.
   */
  static async pruneSyncedHistory(options: {
    daysThreshold?: number;
    batchSize?: number;
    vacuum?: boolean;
    db?: any;
  } = {}): Promise<CleanupResult> {
    const client = options.db || prisma;
    if (this.isRunning) {
      throw new Error('Sync retention cleanup is already running.');
    }

    this.isRunning = true;
    const startTime = Date.now();
    const days = options.daysThreshold ?? 7;
    const batchSize = options.batchSize ?? 500;
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let totalPruned = 0;

    try {
      // 1. Ensure durable timestamp is saved before pruning any records
      const latestSynced = await client.syncQueue.findFirst({
        where: { status: 'SYNCED' },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      });

      if (latestSynced?.updatedAt) {
        await client.cloudSyncSettings.upsert({
          where: { id: 1 },
          update: {
            lastSuccessfulUpstreamSyncAt: latestSynced.updatedAt,
          },
          create: {
            id: 1,
            syncEnabled: true,
            downstreamEnabled: true,
            lastSuccessfulUpstreamSyncAt: latestSynced.updatedAt,
          },
        });
      }

      // 2. Perform safe batched deletion in transactions of batchSize
      while (true) {
        // Find batch of eligible eventUuids to delete
        const batch = await client.syncQueue.findMany({
          where: {
            status: 'SYNCED',
            updatedAt: { lt: cutoffDate },
          },
          select: { eventUuid: true },
          take: batchSize,
        });

        if (batch.length === 0) {
          break;
        }

        const uuidsToDelete = batch.map((b: any) => b.eventUuid);

        const deleteResult = await client.$transaction(async (tx: any) => {
          return await tx.syncQueue.deleteMany({
            where: {
              eventUuid: { in: uuidsToDelete },
              status: 'SYNCED', // Double safety guard
            },
          });
        });

        totalPruned += deleteResult.count;
      }

      // 3. Mark lastLocalSyncCleanupAt
      await client.cloudSyncSettings.upsert({
        where: { id: 1 },
        update: {
          lastLocalSyncCleanupAt: new Date(),
        },
        create: {
          id: 1,
          syncEnabled: true,
          downstreamEnabled: true,
          lastLocalSyncCleanupAt: new Date(),
        },
      });

      // 4. Check remaining stats
      const remainingSynced = await client.syncQueue.count({ where: { status: 'SYNCED' } });
      const pendingCount = await client.syncQueue.count({ where: { status: 'PENDING' } });
      const failedCount = await client.syncQueue.count({ where: { status: 'FAILED' } });

      let vacuumExecuted = false;
      if (options.vacuum) {
        // Safe incremental vacuum or full vacuum
        await client.$executeRawUnsafe(`PRAGMA incremental_vacuum;`);
        vacuumExecuted = true;
      }

      const durationMs = Date.now() - startTime;
      console.log(`[SYNC RETENTION] Pruned ${totalPruned} old SYNCED rows in ${durationMs}ms.`);

      return {
        prunedCount: totalPruned,
        remainingSynced,
        pendingCount,
        failedCount,
        durationMs,
        vacuumExecuted,
        skipped: false,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Diagnostic summary of FAILED events (READ-ONLY)
   */
  static async getFailedEventsDiagnostic(db?: any) {
    const client = db || prisma;
    const failedEvents = await client.syncQueue.findMany({
      where: { status: 'FAILED' },
      select: {
        eventUuid: true,
        entityType: true,
        operation: true,
        error: true,
        retryCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const byEntity: Record<string, number> = {};
    const byOperation: Record<string, number> = {};
    const byCategory: Record<string, number> = {
      missingFkMapping: 0,
      networkTimeout: 0,
      constraintFailure: 0,
      validationFailure: 0,
      other: 0,
    };
    const byRetryCount: Record<number, number> = {};

    for (const event of failedEvents) {
      // By entity
      byEntity[event.entityType] = (byEntity[event.entityType] || 0) + 1;
      // By operation
      byOperation[event.operation] = (byOperation[event.operation] || 0) + 1;
      // By retry count
      byRetryCount[event.retryCount] = (byRetryCount[event.retryCount] || 0) + 1;

      const err = (event.error || '').toLowerCase();
      if (err.includes('missing') && (err.includes('uuid') || err.includes('foreign') || err.includes('sale_uuid') || err.includes('product_uuid'))) {
        byCategory.missingFkMapping++;
      } else if (err.includes('timeout') || err.includes('econnrefused') || err.includes('network')) {
        byCategory.networkTimeout++;
      } else if (err.includes('constraint') || err.includes('unique') || err.includes('foreign key')) {
        byCategory.constraintFailure++;
      } else if (err.includes('validation') || err.includes('invalid')) {
        byCategory.validationFailure++;
      } else {
        byCategory.other++;
      }
    }

    return {
      totalFailed: failedEvents.length,
      byEntity,
      byOperation,
      byCategory,
      byRetryCount,
    };
  }
}
