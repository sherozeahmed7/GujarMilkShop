import { prisma } from '../config/database';
import axios from 'axios';
import crypto from 'crypto';

let isSyncing = false;

// Convert environment variables or defaults
const SYNC_INTERVAL_MS = parseInt(process.env.SYNC_INTERVAL_MS || '10000', 10);
const SYNC_BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE || '50', 10);
const SYNC_WORKER_ENABLED = process.env.SYNC_WORKER_ENABLED === 'true';
const SYNC_INTERNAL_SECRET = process.env.SYNC_INTERNAL_SECRET || 'secret';
const API_URL = process.env.SYNC_API_URL || 'http://localhost:5000/api/sync/batch';

function calculateNextRetry(retryCount: number): Date {
  const now = new Date();
  switch (retryCount) {
    case 0: return now; // immediate
    case 1: return new Date(now.getTime() + 30 * 1000); // 30s
    case 2: return new Date(now.getTime() + 2 * 60 * 1000); // 2m
    case 3: return new Date(now.getTime() + 10 * 60 * 1000); // 10m
    default: return new Date(now.getTime() + 30 * 60 * 1000); // 30m
  }
}

import { isRestoreInProgress } from '../utils/restoreLock';

export async function processSyncQueue() {
  if (isSyncing || isRestoreInProgress()) return;
  isSyncing = true;

  try {
    // 0. Check local DB setting
    const localSettings = await prisma.cloudSyncSettings.findUnique({ where: { id: 1 } });
    if (localSettings && !localSettings.syncEnabled) {
      isSyncing = false;
      return;
    }

    // 1. Stale SYNCING recovery (e.g. crashed during sync)
    // If an event has been SYNCING for more than 5 minutes, reset it
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    await prisma.syncQueue.updateMany({
      where: {
        status: 'SYNCING',
        updatedAt: { lt: fiveMinutesAgo }
      },
      data: { status: 'PENDING' }
    });

    // 2. Identify blocked UUIDs (FAILED or future PENDING)
    const failedEvents = await prisma.syncQueue.findMany({
      where: { status: 'FAILED' },
      select: { cloudUuid: true }
    });
    
    const futureEvents = await prisma.syncQueue.findMany({
      where: { 
        status: 'PENDING',
        nextRetryAt: { gt: new Date() }
      },
      select: { cloudUuid: true }
    });

    const blockedUuids = new Set<string>([
      ...failedEvents.map(e => e.cloudUuid),
      ...futureEvents.map(e => e.cloudUuid)
    ]);

    // 3. Fetch ready PENDING events
    const readyCreates = await prisma.syncQueue.findMany({
      where: {
        status: 'PENDING',
        operation: { not: 'DELETE' },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }]
      },
      orderBy: [{ layer: 'asc' }, { createdAt: 'asc' }]
    });

    const readyDeletes = await prisma.syncQueue.findMany({
      where: {
        status: 'PENDING',
        operation: 'DELETE',
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }]
      },
      orderBy: [{ layer: 'desc' }, { createdAt: 'asc' }]
    });

    // Combine and apply batch limit
    const allReady = [...readyCreates, ...readyDeletes];
    const eventsToProcess = [];

    // 4. Dependency filter
    for (const event of allReady) {
      if (eventsToProcess.length >= SYNC_BATCH_SIZE) break;

      let isBlocked = false;
      // if this event itself is blocked, skip
      if (blockedUuids.has(event.cloudUuid)) {
        isBlocked = true;
      } else {
        // check payload for any blocked UUID references
        for (const blocked of blockedUuids) {
          if (event.payload.includes(blocked)) {
            isBlocked = true;
            break;
          }
        }
      }

      if (isBlocked) {
        // Cascade block: if this event is blocked, anything referencing it is also blocked
        blockedUuids.add(event.cloudUuid);
      } else {
        eventsToProcess.push(event);
      }
    }

    if (eventsToProcess.length === 0) {
      isSyncing = false;
      return;
    }

    // 5. Atomic Claim
    const eventUuids = eventsToProcess.map(e => e.eventUuid);
    await prisma.syncQueue.updateMany({
      where: { eventUuid: { in: eventUuids }, status: 'PENDING' },
      data: { status: 'SYNCING' }
    });

    // 6. Send to API
    const payloads = eventsToProcess.map(e => ({
      eventUuid: e.eventUuid,
      cloudUuid: e.cloudUuid,
      entityType: e.entityType,
      deviceId: e.deviceId,
      localId: e.localId,
      operation: e.operation,
      payload: e.payload
    }));

    const batchId = crypto.randomUUID();
    let apiResponse;
    let apiError: any = null;

    try {
      apiResponse = await axios.post(API_URL, {
        batchId,
        payloads
      }, {
        headers: { 'x-sync-secret': SYNC_INTERNAL_SECRET },
        timeout: 90000 // 90 seconds timeout for Neon
      });
    } catch (err: any) {
      apiError = err;
    }

    // 7. Handle Results
    if (apiError) {
      console.error('[SYNC WORKER] Network or API error:', apiError.message);
      
      const isPermanentApiError = apiError.response && apiError.response.status === 400;

      for (const event of eventsToProcess) {
        if (isPermanentApiError) {
          // Permanent failure (e.g. validation error)
          await prisma.syncQueue.update({
            where: { eventUuid: event.eventUuid },
            data: { status: 'FAILED', error: apiError.message }
          });
        } else {
          // Retryable error (network, 5xx)
          const newRetryCount = event.retryCount + 1;
          if (newRetryCount >= 5) {
            await prisma.syncQueue.update({
              where: { eventUuid: event.eventUuid },
              data: { status: 'FAILED', error: 'Max retries reached: ' + apiError.message, retryCount: newRetryCount }
            });
          } else {
            await prisma.syncQueue.update({
              where: { eventUuid: event.eventUuid },
              data: { 
                status: 'PENDING', 
                error: apiError.message, 
                retryCount: newRetryCount,
                nextRetryAt: calculateNextRetry(newRetryCount)
              }
            });
          }
        }
      }
    } else {
      // API responded with partial/full success results
      const results = apiResponse?.data?.results || [];
      const resultMap = new Map(results.map((r: any) => [r.eventUuid, r]));

      for (const event of eventsToProcess) {
        const result: any = resultMap.get(event.eventUuid);
        if (!result) {
          // Event was sent but API didn't return a result for it. 
          // Treat as network error/retryable.
          const newRetryCount = event.retryCount + 1;
          if (newRetryCount >= 5) {
            await prisma.syncQueue.update({
              where: { eventUuid: event.eventUuid },
              data: { status: 'FAILED', error: 'Missing from API response', retryCount: newRetryCount }
            });
          } else {
            await prisma.syncQueue.update({
              where: { eventUuid: event.eventUuid },
              data: { 
                status: 'PENDING', 
                retryCount: newRetryCount,
                nextRetryAt: calculateNextRetry(newRetryCount),
                error: 'Missing from API response'
              }
            });
          }
          continue;
        }

        if (result.status === 'SYNCED') {
          if (result.resolvedUuid && result.resolvedUuid !== event.cloudUuid) {
            // The upstream resolved this to an existing record's true UUID. Atomically heal mappings.
            await prisma.$transaction([
              prisma.localToCloudMapping.updateMany({
                where: { deviceId: event.deviceId, entityType: event.entityType, localId: event.localId },
                data: { cloudUuid: result.resolvedUuid }
              }),
              prisma.syncQueue.update({
                where: { eventUuid: event.eventUuid },
                data: { status: 'SYNCED', error: null, cloudUuid: result.resolvedUuid }
              })
            ]);
          } else {
            await prisma.syncQueue.update({
              where: { eventUuid: event.eventUuid },
              data: { status: 'SYNCED', error: null }
            });
          }
        } else {
          // Event failed on server side
          if (result.retryable) {
            const newRetryCount = event.retryCount + 1;
            if (newRetryCount >= 5) {
              await prisma.syncQueue.update({
                where: { eventUuid: event.eventUuid },
                data: { status: 'FAILED', error: result.error, retryCount: newRetryCount }
              });
            } else {
              await prisma.syncQueue.update({
                where: { eventUuid: event.eventUuid },
                data: { 
                  status: 'PENDING', 
                  error: result.error, 
                  retryCount: newRetryCount,
                  nextRetryAt: calculateNextRetry(newRetryCount)
                }
              });
            }
          } else {
            // Permanent server error
            await prisma.syncQueue.update({
              where: { eventUuid: event.eventUuid },
              data: { status: 'FAILED', error: result.error, retryCount: event.retryCount + 1 }
            });
          }
        }
      }
    }
  } catch (error: any) {
    console.error('[SYNC WORKER] Unhandled exception:', error.message);
  } finally {
    isSyncing = false;
  }
}

// ---------------------------------------------------------
// Startup Logic
// ---------------------------------------------------------
let workerInterval: NodeJS.Timeout | null = null;

export function startSyncWorker() {
  if (!SYNC_WORKER_ENABLED) {
    console.log('[SYNC WORKER] Sync worker is disabled (SYNC_WORKER_ENABLED=false).');
    return;
  }

  if (workerInterval) {
    console.log('[SYNC WORKER] Worker is already running.');
    return;
  }

  console.log(`[SYNC WORKER] Starting local sync worker (interval: ${SYNC_INTERVAL_MS}ms, batch size: ${SYNC_BATCH_SIZE})`);
  
  workerInterval = setInterval(() => {
    processSyncQueue().catch(err => {
      console.error('[SYNC WORKER] Loop error:', err.message);
    });
  }, SYNC_INTERVAL_MS);
}

export function stopSyncWorker() {
  if (workerInterval) {
    clearInterval(workerInterval);
    workerInterval = null;
    console.log('[SYNC WORKER] Stopped.');
  }
}
