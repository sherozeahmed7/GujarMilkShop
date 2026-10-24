import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { getDeviceId } from '../utils/deviceId';
import { processSyncQueue } from '../workers/syncWorker';
import { getNeonPool } from '../config/neonDb';

const ENV_SYNC_ENABLED = process.env.SYNC_WORKER_ENABLED === 'true';
const ENV_DOWNSTREAM_ENABLED = process.env.DOWNSTREAM_SYNC_ENABLED === 'true';

// Helper: ensure the CloudSyncSettings row exists
async function getOrCreateSettings() {
  const existing = await prisma.cloudSyncSettings.findUnique({ where: { id: 1 } });
  if (existing) return existing;
  return prisma.cloudSyncSettings.create({
    data: { id: 1, syncEnabled: true, downstreamEnabled: true }
  });
}

// GET /api/sync/status
export async function getSyncStatus(req: Request, res: Response) {
  try {
    const settings = await getOrCreateSettings();

    const pending = await prisma.syncQueue.count({ where: { status: 'PENDING' } });
    const syncing = await prisma.syncQueue.count({ where: { status: 'SYNCING' } });
    const failed  = await prisma.syncQueue.count({ where: { status: 'FAILED' } });

    // Prefer durable timestamp from settings; fallback to latest SYNCED queue record
    let lastSuccessfulSync = settings.lastSuccessfulUpstreamSyncAt;
    if (!lastSuccessfulSync) {
      const lastSyncedEvent = await prisma.syncQueue.findFirst({
        where: { status: 'SYNCED' },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true }
      });
      lastSuccessfulSync = lastSyncedEvent?.updatedAt ?? null;
    }

    // Lightweight Neon connectivity check
    let cloudConnected = false;
    try {
      const pool = getNeonPool();
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      cloudConnected = true;
    } catch {
      cloudConnected = false;
    }

    const effectiveSyncEnabled = ENV_SYNC_ENABLED && settings.syncEnabled;
    const effectiveDownstreamEnabled = ENV_DOWNSTREAM_ENABLED && settings.downstreamEnabled;

    res.json({
      syncEnabled: effectiveSyncEnabled,
      downstreamEnabled: effectiveDownstreamEnabled,
      localSyncEnabled: settings.syncEnabled,
      localDownstreamEnabled: settings.downstreamEnabled,
      deviceId: getDeviceId(),
      pending,
      syncing,
      failed,
      lastSuccessfulSync: lastSuccessfulSync ?? null,
      lastChecked: new Date().toISOString(),
      cloudConnected,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/sync/queue
export async function getSyncQueue(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const items = await prisma.syncQueue.findMany({
      where: { status: { not: 'SYNCED' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        eventUuid: true,
        entityType: true,
        operation: true,
        status: true,
        retryCount: true,
        error: true,
        createdAt: true,
        cloudUuid: true,
        localId: true,
      }
    });
    res.json({ items });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/sync/trigger  — manually kick the existing worker
export async function triggerSync(req: Request, res: Response) {
  try {
    const settings = await getOrCreateSettings();
    const effectiveSyncEnabled = ENV_SYNC_ENABLED && settings.syncEnabled;

    if (!effectiveSyncEnabled) {
      return res.status(400).json({ success: false, message: 'Sync is currently disabled.' });
    }

    // Fire and forget — do not await so we don't block the HTTP response
    processSyncQueue().catch(err => {
      console.error('[SYNC TRIGGER] Error during manual sync:', err.message);
    });

    res.json({ success: true, message: 'Sync triggered. Processing in background.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/sync/retry-failed  — reset FAILED events back to PENDING
export async function retryFailed(req: Request, res: Response) {
  try {
    const result = await prisma.syncQueue.updateMany({
      where: { status: 'FAILED' },
      data: {
        status: 'PENDING',
        retryCount: 0,
        nextRetryAt: null,
        error: null,
      }
    });
    res.json({ success: true, reset: result.count });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/sync/toggle  — enable/disable local sync setting (Disconnect / Reconnect)
export async function toggleSync(req: Request, res: Response) {
  try {
    const { syncEnabled, downstreamEnabled } = req.body;
    const updated = await prisma.cloudSyncSettings.upsert({
      where: { id: 1 },
      update: {
        ...(typeof syncEnabled === 'boolean' ? { syncEnabled } : {}),
        ...(typeof downstreamEnabled === 'boolean' ? { downstreamEnabled } : {}),
      },
      create: {
        id: 1,
        syncEnabled: typeof syncEnabled === 'boolean' ? syncEnabled : true,
        downstreamEnabled: typeof downstreamEnabled === 'boolean' ? downstreamEnabled : true,
      }
    });
    res.json({ success: true, settings: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/sync/check-connection  — verify Neon reachability
export async function checkConnection(req: Request, res: Response) {
  try {
    const pool = getNeonPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    res.json({ success: true, message: 'Cloud connection verified.' });
  } catch (err: any) {
    res.status(503).json({ success: false, message: 'Cloud connection failed: ' + err.message });
  }
}

// GET /api/sync/failed-diagnostics — read-only diagnostics on FAILED SyncQueue rows
export async function getFailedDiagnostics(req: Request, res: Response) {
  try {
    const { SyncRetentionService } = await import('../services/syncRetention.service');
    const diagnostics = await SyncRetentionService.getFailedEventsDiagnostic();
    res.json({ success: true, diagnostics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/sync/prune — manual retention cleanup execution
export async function runManualPrune(req: Request, res: Response) {
  try {
    const { SyncRetentionService } = await import('../services/syncRetention.service');
    const daysThreshold = parseInt(req.body?.daysThreshold as string, 10) || 7;
    const vacuum = req.body?.vacuum === true;
    const result = await SyncRetentionService.pruneSyncedHistory({ daysThreshold, vacuum });
    res.json({ success: true, result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/sync/diagnostics/checkout — returns diagnostic metadata for client hardware / SQLite state
export async function getCheckoutDiagnostics(req: Request, res: Response) {
  try {
    const os = require('os');
    const fs = require('fs');

    const journalModeResult: any = await (prisma as any).$queryRawUnsafe('PRAGMA journal_mode;');
    const synchronousResult: any = await (prisma as any).$queryRawUnsafe('PRAGMA synchronous;');
    const busyTimeoutResult: any = await (prisma as any).$queryRawUnsafe('PRAGMA busy_timeout;');
    const walAutocheckpointResult: any = await (prisma as any).$queryRawUnsafe('PRAGMA wal_autocheckpoint;');

    const dbUrl = process.env.DATABASE_URL || '';
    let dbPath = dbUrl.replace(/^file:/, '').replace(/^['"]|['"]$/g, '');
    let dbSizeBytes = 0;
    let walSizeBytes = 0;

    try {
      if (fs.existsSync(dbPath)) {
        dbSizeBytes = fs.statSync(dbPath).size;
        const walPath = dbPath + '-wal';
        if (fs.existsSync(walPath)) {
          walSizeBytes = fs.statSync(walPath).size;
        }
      }
    } catch {
      // non-fatal
    }

    const cpus = os.cpus() || [];
    const cpuModel = cpus.length > 0 ? cpus[0].model : 'Unknown';
    const cpuCount = cpus.length;
    const totalMemoryMb = Math.round(os.totalmem() / (1024 * 1024));
    const freeMemoryMb = Math.round(os.freemem() / (1024 * 1024));

    res.json({
      success: true,
      data: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuModel,
        cpuCount,
        totalMemoryMb,
        freeMemoryMb,
        databaseFile: dbPath,
        dbSizeBytes,
        walSizeBytes,
        journalMode: journalModeResult?.[0]?.journal_mode ? String(journalModeResult[0].journal_mode) : 'unknown',
        synchronous: synchronousResult?.[0]?.synchronous !== undefined ? Number(synchronousResult[0].synchronous) : 'unknown',
        busyTimeout: busyTimeoutResult?.[0]?.timeout !== undefined ? Number(busyTimeoutResult[0].timeout) : 5000,
        walAutocheckpoint: walAutocheckpointResult?.[0]?.wal_autocheckpoint !== undefined ? Number(walAutocheckpointResult[0].wal_autocheckpoint) : 1000,
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

