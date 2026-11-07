import { prisma } from '../config/database';
import { processSyncQueue } from '../workers/syncWorker';
import { processDownstreamSync } from '../workers/downstreamSyncWorker';

export interface AutoRepairReport {
  staleSyncingReset: number;
  failedEventsHealed: number;
  orphanedMappingsRepaired: number;
  downstreamCursorRepaired: boolean;
  upstreamTriggered: boolean;
  downstreamTriggered: boolean;
  timestamp: string;
}

export class SyncAutoRepairService {
  /**
   * Universal Self-Healing and Auto-Repair engine for Cloud & Sync.
   * Resolves common sync faults:
   * 1. Stale SYNCING locks from unexpected app closures or crashes.
   * 2. Failed events due to transient timeouts or temporary network drops.
   * 3. Broken / desynchronized entity mappings between local SQLite and cloud Neon.
   * 4. Downstream cursor deadlocks.
   * 5. Instantly kicks both upstream and downstream sync loops.
   */
  static async runAutoRepair(): Promise<AutoRepairReport> {
    const report: AutoRepairReport = {
      staleSyncingReset: 0,
      failedEventsHealed: 0,
      orphanedMappingsRepaired: 0,
      downstreamCursorRepaired: false,
      upstreamTriggered: false,
      downstreamTriggered: false,
      timestamp: new Date().toISOString(),
    };

    // 1. Release Stale SYNCING Events (stuck > 2 minutes)
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
      const staleRes = await prisma.syncQueue.updateMany({
        where: {
          status: 'SYNCING',
          updatedAt: { lt: twoMinutesAgo },
        },
        data: {
          status: 'PENDING',
          error: null,
        },
      });
      report.staleSyncingReset = staleRes.count;
    } catch (err: any) {
      console.warn('[SyncAutoRepair] Error resetting stale syncing events:', err?.message);
    }

    // 2. Heal and Re-queue FAILED Events (including foreign key constraint mismatches and schema mismatches)
    try {
      // Find all failed events or events with constraint/schema errors
      const failedEvents = await prisma.syncQueue.findMany({
        where: {
          OR: [
            { status: 'FAILED' },
            { error: { contains: 'violates foreign key constraint' } },
            { error: { contains: 'supplier_uuid' } },
            { error: { contains: 'relation' } },
            { error: { contains: 'does not exist' } },
            { error: { contains: 'current transaction is aborted' } },
            { error: { contains: 'transaction block' } }
          ]
        }
      });

      // Sanitize any payloads where Supplier entity had supplier_uuid injected
      for (const ev of failedEvents) {
        if (ev.entityType === 'Supplier' && ev.payload) {
          try {
            const p = JSON.parse(ev.payload);
            if (p.supplier_uuid !== undefined || p.supplierUuid !== undefined) {
              delete p.supplier_uuid;
              delete p.supplierUuid;
              await prisma.syncQueue.update({
                where: { eventUuid: ev.eventUuid },
                data: { payload: JSON.stringify(p) }
              });
            }
          } catch {}
        }
      }

      const failedRes = await prisma.syncQueue.updateMany({
        where: {
          OR: [
            { status: 'FAILED' },
            { error: { contains: 'violates foreign key constraint' } },
            { error: { contains: 'supplier_uuid' } },
            { error: { contains: 'relation' } },
            { error: { contains: 'does not exist' } },
            { error: { contains: 'current transaction is aborted' } },
            { error: { contains: 'transaction block' } }
          ]
        },
        data: {
          status: 'PENDING',
          retryCount: 0,
          nextRetryAt: null,
          error: null,
        },
      });
      report.failedEventsHealed = failedRes.count;
    } catch (err: any) {
      console.warn('[SyncAutoRepair] Error healing failed events:', err?.message);
    }

    // 3. Heal Entity Mappings: Backfill missing cloudUuid on business tables
    try {
      // Ensure cloudSyncSettings is enabled
      await prisma.cloudSyncSettings.upsert({
        where: { id: 1 },
        update: { syncEnabled: true, downstreamEnabled: true },
        create: { id: 1, syncEnabled: true, downstreamEnabled: true },
      });

      // Recover any customer/supplier/sale rows with missing cloudUuid if mapped
      try {
        const mappings = await prisma.localToCloudMapping.findMany({
          take: 200,
          orderBy: { id: 'desc' },
        });

        for (const m of mappings) {
          if (!m.cloudUuid) continue;
          try {
            if (m.entityType === 'Customer') {
              const updated = await prisma.customer.updateMany({
                where: { id: m.localId, cloudUuid: null as any },
                data: { cloudUuid: m.cloudUuid },
              });
              if (updated.count > 0) report.orphanedMappingsRepaired++;
            } else if (m.entityType === 'Supplier') {
              const updated = await prisma.supplier.updateMany({
                where: { id: m.localId, cloudUuid: null as any },
                data: { cloudUuid: m.cloudUuid },
              });
              if (updated.count > 0) report.orphanedMappingsRepaired++;
            }
          } catch {
            // column or mapping might differ, continue
          }
        }
      } catch {
        // LocalToCloudMapping table optional
      }
    } catch (err: any) {
      console.warn('[SyncAutoRepair] Mapping check error:', err?.message);
    }

    // 4. Downstream State Health Check & DNS/Connection Error Auto-Heal
    try {
      const dsState = await prisma.downstreamSyncState.findFirst({ where: { id: 1 } });
      if (dsState?.lastError) {
        // Clear lastError if it was caused by temporary network drops, DNS ENOTFOUND, or transient 500/503 errors
        const isTransient = 
          dsState.lastError.includes('ENOTFOUND') ||
          dsState.lastError.includes('getaddrinfo') ||
          dsState.lastError.includes('status code 500') ||
          dsState.lastError.includes('status code 503') ||
          dsState.lastError.includes('ECONNREFUSED') ||
          dsState.lastError.includes('ETIMEDOUT') ||
          dsState.lastError.includes('temporary');

        if (isTransient || !dsState.lastError.startsWith('RESTORE_REQUIRED')) {
          await prisma.downstreamSyncState.update({
            where: { id: 1 },
            data: { lastError: null },
          });
          report.downstreamCursorRepaired = true;
        }
      }
    } catch (err: any) {
      console.warn('[SyncAutoRepair] Downstream cursor check error:', err?.message);
    }

    // 5. Fire immediate background sync in both directions
    try {
      processSyncQueue().catch((e) => console.error('[SyncAutoRepair] Upstream trigger error:', e));
      report.upstreamTriggered = true;
    } catch (e) {
      // ignore
    }

    try {
      processDownstreamSync().catch((e) => console.error('[SyncAutoRepair] Downstream trigger error:', e));
      report.downstreamTriggered = true;
    } catch (e) {
      // ignore
    }

    return report;
  }
}

