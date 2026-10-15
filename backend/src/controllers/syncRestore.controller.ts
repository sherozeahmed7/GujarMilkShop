import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { getNeonPool, queryWithRetry } from '../config/neonDb';
import { getDeviceId } from '../utils/deviceId';
import { setRestoreInProgress, isRestoreInProgress } from '../utils/restoreLock';
import {
  applyCreate,
  applyUpdate,
  applyMilkProductDailyStockUpsert,
  ensureMapping,
} from '../workers/downstreamSyncWorker';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * Creates a crash-safe point-in-time backup of the local SQLite database.
 * Flushes the WAL journal via PRAGMA wal_checkpoint(TRUNCATE) and performs
 * VACUUM INTO to create an atomic, non-destructive snapshot.
 */
async function performConsistentSqliteBackup(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Determine backup directory
  let backupDir: string;
  if ((process as any).pkg) {
    const appData = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
    backupDir = path.join(appData, 'com.shero.tauri-app', 'backups');
  } else {
    backupDir = path.join(process.cwd(), 'prisma', 'backups');
  }

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilename = `pos_pre_restore_${timestamp}.db`;
  const targetBackupPath = path.join(backupDir, backupFilename);

  // 1. Force WAL flush to disk
  try {
    await prisma.$executeRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE)`);
  } catch (err: any) {
    console.warn('[Restore] Notice: wal_checkpoint truncate returned:', err?.message);
  }

  // 2. Perform SQLite online backup via VACUUM INTO
  const escapedPath = targetBackupPath.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedPath}'`);

  if (!fs.existsSync(targetBackupPath) || fs.statSync(targetBackupPath).size === 0) {
    throw new Error(`Consistent SQLite backup verification failed at: ${targetBackupPath}`);
  }

  console.log(`[Restore] ✅ Consistent pre-restore backup created: ${targetBackupPath} (${fs.statSync(targetBackupPath).size} bytes)`);
  return targetBackupPath;
}

/**
 * POST /api/sync/restore
 * Safely restores full state from Neon PostgreSQL to Local SQLite.
 *
 * Safety rules:
 * 1. Rejects if SyncQueue has ANY PENDING, SYNCING or FAILED events.
 * 2. Pauses upstream/downstream background workers and POS concurrent writes via restoreLock.
 * 3. Creates a consistent VACUUM INTO SQLite backup prior to touching data.
 * 4. Downloads Neon data under a single REPEATABLE READ snapshot with MAX(change_sequence).
 * 5. Reconciles/upserts records in strict dependency layers reusing existing applicators.
 * 6. Advances DownstreamSyncState.lastCursor ONLY after full local transaction commits.
 * 7. Never truncates, drops or destructively deletes local data.
 */
export async function restoreCloudData(req: Request, res: Response): Promise<void> {
  if (isRestoreInProgress()) {
    res.status(409).json({ error: 'A restore operation is already in progress.' });
    return;
  }

  // 1. Check local SyncQueue for any unsynced or failed changes
  const pendingCount = await prisma.syncQueue.count({
    where: { status: { in: ['PENDING', 'SYNCING', 'FAILED'] } }
  });

  if (pendingCount > 0) {
    res.status(409).json({
      error: `Cannot restore cloud data. There are ${pendingCount} unsynced or failed local item(s) in SyncQueue. Please sync or resolve them first.`,
      pendingCount
    });
    return;
  }

  // 2. Check Neon connectivity
  let pool;
  try {
    pool = getNeonPool();
    await queryWithRetry('SELECT 1');
  } catch (err: any) {
    res.status(503).json({ error: `Neon PostgreSQL is unreachable: ${err.message}` });
    return;
  }

  // 3. Acquire Restore Mutex
  setRestoreInProgress(true);
  let backupPath = '';

  try {
    // 4. Create crash-safe local SQLite backup
    backupPath = await performConsistentSqliteBackup();

    // 5. Query Neon under a single REPEATABLE READ transaction to guarantee snapshot consistency
    const client = await pool.connect();
    let maxSequence = BigInt(0);
    const snapshot: Record<string, any[]> = {};

    try {
      await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');

      // Capture cursor at exact snapshot time
      const cursorRes = await client.query('SELECT COALESCE(MAX(change_sequence), 0) AS max_seq FROM cloud_sync_events');
      maxSequence = BigInt(cursorRes.rows[0]?.max_seq || '0');

      // Layer 0: Master records
      const usersRes = await client.query('SELECT * FROM users ORDER BY created_at ASC');
      snapshot['User'] = usersRes.rows;

      const suppliersRes = await client.query('SELECT * FROM suppliers ORDER BY created_at ASC');
      snapshot['Supplier'] = suppliersRes.rows;

      const productsRes = await client.query('SELECT * FROM inventory_products ORDER BY created_at ASC');
      snapshot['InventoryProduct'] = productsRes.rows;

      const customersRes = await client.query('SELECT * FROM customers ORDER BY created_at ASC');
      snapshot['Customer'] = customersRes.rows;

      const dailyRatesRes = await client.query('SELECT * FROM daily_rates ORDER BY date ASC');
      snapshot['DailyRate'] = dailyRatesRes.rows;

      const cashPersonsRes = await client.query('SELECT * FROM cash_persons ORDER BY created_at ASC');
      snapshot['CashPerson'] = cashPersonsRes.rows;

      // Layer 1: Sessions & Transactions Headers
      const dailyStockRes = await client.query('SELECT * FROM milk_product_daily_stocks ORDER BY date ASC');
      snapshot['MilkProductDailyStock'] = dailyStockRes.rows;

      const shiftsRes = await client.query('SELECT * FROM shifts ORDER BY opened_at ASC');
      snapshot['Shift'] = shiftsRes.rows;

      const salesRes = await client.query('SELECT * FROM sales ORDER BY created_at ASC');
      snapshot['Sale'] = salesRes.rows;

      const supplierCollectionsRes = await client.query('SELECT * FROM supplier_collections ORDER BY created_at ASC');
      snapshot['SupplierCollection'] = supplierCollectionsRes.rows;

      const expensesRes = await client.query('SELECT * FROM expenses ORDER BY created_at ASC');
      snapshot['Expense'] = expensesRes.rows;

      const returnsRes = await client.query('SELECT * FROM returns ORDER BY created_at ASC');
      snapshot['Return'] = returnsRes.rows;

      // Layer 2: Details, Line Items, Payments, Movements
      const saleItemsRes = await client.query('SELECT * FROM sale_items ORDER BY created_at ASC');
      snapshot['SaleItem'] = saleItemsRes.rows;

      const paymentsRes = await client.query('SELECT * FROM payments ORDER BY created_at ASC');
      snapshot['Payment'] = paymentsRes.rows;

      const supplierPaymentsRes = await client.query('SELECT * FROM supplier_payments ORDER BY created_at ASC');
      snapshot['SupplierPayment'] = supplierPaymentsRes.rows;

      const expensePaymentsRes = await client.query('SELECT * FROM expense_payments ORDER BY created_at ASC');
      snapshot['ExpensePayment'] = expensePaymentsRes.rows;

      const returnItemsRes = await client.query('SELECT * FROM return_items ORDER BY id ASC');
      snapshot['ReturnItem'] = returnItemsRes.rows;

      const inventoryMovementsRes = await client.query('SELECT * FROM inventory_movements ORDER BY date ASC');
      snapshot['InventoryMovement'] = inventoryMovementsRes.rows;

      const conversionsRes = await client.query('SELECT * FROM butter_ghee_conversions ORDER BY date ASC');
      snapshot['ButterGheeConversion'] = conversionsRes.rows;

      const cashbookTransactionsRes = await client.query('SELECT * FROM cashbook_transactions ORDER BY created_at ASC');
      snapshot['CashbookTransaction'] = cashbookTransactionsRes.rows;

      const auditRecordsRes = await client.query('SELECT * FROM audit_records ORDER BY created_at ASC');
      snapshot['AuditRecord'] = auditRecordsRes.rows;

      const activityLogsRes = await client.query('SELECT * FROM activity_logs ORDER BY created_at ASC');
      snapshot['ActivityLog'] = activityLogsRes.rows;

      await client.query('COMMIT');
    } catch (neonErr: any) {
      await client.query('ROLLBACK').catch(() => {});
      throw new Error(`Failed to fetch cloud snapshot: ${neonErr.message}`);
    } finally {
      client.release();
    }

    const localDeviceId = getDeviceId();
    const restoredCounts: Record<string, number> = {};

    // 6. Ingest snapshot into local SQLite in strict topological order inside a transaction
    await prisma.$transaction(async (tx) => {
      // Helper to process an entity array
      const processEntityLayer = async (entityType: string, rows: any[]) => {
        let count = 0;
        for (const row of (rows || [])) {
          const cloudUuid = row.id;
          if (!cloudUuid) continue;

          // Check if already mapped locally (first via direct cloudUuid, then fallback to LocalToCloudMapping)
          let localId: number | null = null;
          try {
            const delegate = (tx as any)[entityType.charAt(0).toLowerCase() + entityType.slice(1)];
            if (delegate && typeof delegate.findFirst === 'function') {
              const directMatch = await delegate.findFirst({
                where: { cloudUuid },
                select: { id: true }
              });
              if (directMatch) {
                localId = directMatch.id;
              }
            }
          } catch {
            // Model doesn't support cloudUuid
          }

          if (!localId) {
            try {
              const existingMapping = await tx.localToCloudMapping.findFirst({
                where: { entityType, cloudUuid }
              });
              if (existingMapping) {
                localId = existingMapping.localId;
              }
            } catch {
              // LocalToCloudMapping table dropped in Migration 009
            }
          }

          if (localId) {
            // Reconcile/update master records if already present
            if (['Customer', 'Supplier', 'InventoryProduct', 'User', 'CashPerson'].includes(entityType)) {
              try {
                await applyUpdate(tx, entityType, localId, cloudUuid, row, localDeviceId);
              } catch (updateErr: any) {
                console.warn(`[Restore] ⚠️ Mapped ${entityType} #${localId} (UUID: ${cloudUuid}) could not be updated (${updateErr?.message || updateErr}). Recreating locally...`);
                await applyCreate(tx, entityType, cloudUuid, row, localDeviceId, localDeviceId);
                count++;
              }
            }
          } else {
            // Apply creation via downstream applicator
            await applyCreate(tx, entityType, cloudUuid, row, localDeviceId, localDeviceId);
            count++;
          }
        }
        restoredCounts[entityType] = count;
      };

      // Ingestion Sequence
      // Layer 0: Masters
      await processEntityLayer('User', snapshot['User']);
      await processEntityLayer('Supplier', snapshot['Supplier']);
      await processEntityLayer('InventoryProduct', snapshot['InventoryProduct']);
      await processEntityLayer('Customer', snapshot['Customer']);
      await processEntityLayer('DailyRate', snapshot['DailyRate']);
      await processEntityLayer('CashPerson', snapshot['CashPerson']);

      // Layer 1: Sessions & Headers
      await processEntityLayer('MilkProductDailyStock', snapshot['MilkProductDailyStock']);
      await processEntityLayer('Shift', snapshot['Shift']);
      await processEntityLayer('Sale', snapshot['Sale']);
      await processEntityLayer('SupplierCollection', snapshot['SupplierCollection']);
      await processEntityLayer('Expense', snapshot['Expense']);
      await processEntityLayer('Return', snapshot['Return']);

      // Layer 2: Details & Transactions
      await processEntityLayer('SaleItem', snapshot['SaleItem']);
      await processEntityLayer('Payment', snapshot['Payment']);
      await processEntityLayer('SupplierPayment', snapshot['SupplierPayment']);
      await processEntityLayer('ExpensePayment', snapshot['ExpensePayment']);
      await processEntityLayer('ReturnItem', snapshot['ReturnItem']);
      await processEntityLayer('InventoryMovement', snapshot['InventoryMovement']);
      await processEntityLayer('ButterGheeConversion', snapshot['ButterGheeConversion']);
      await processEntityLayer('CashbookTransaction', snapshot['CashbookTransaction']);
      await processEntityLayer('AuditRecord', snapshot['AuditRecord']);
      await processEntityLayer('ActivityLog', snapshot['ActivityLog']);

      // 7. Update cursor ONLY after all entities have successfully committed
      await tx.downstreamSyncState.upsert({
        where: { id: 1 },
        update: {
          lastCursor: maxSequence,
          lastSuccessfulSync: new Date(),
          lastError: null,
        },
        create: {
          id: 1,
          lastCursor: maxSequence,
          lastSuccessfulSync: new Date(),
          lastError: null,
        }
      });
    }, {
      timeout: 60000 // 60s transaction timeout for large restores
    });

    const totalRestored = Object.values(restoredCounts).reduce((acc, n) => acc + n, 0);
    console.log(`[Restore] ✅ Cloud restore complete. Restored ${totalRestored} new records. Cursor set to ${maxSequence}.`);

    res.json({
      success: true,
      message: `Successfully restored ${totalRestored} new records from cloud backup.`,
      backupPath,
      cursor: maxSequence.toString(),
      restoredCounts,
      totalRestored
    });

  } catch (err: any) {
    console.error('[Restore] ❌ Restore failed:', err?.message);
    res.status(500).json({
      error: `Restore failed: ${err.message}. Local database preserved. Pre-restore backup available at ${backupPath}`,
      backupPath
    });
  } finally {
    setRestoreInProgress(false);
  }
}
