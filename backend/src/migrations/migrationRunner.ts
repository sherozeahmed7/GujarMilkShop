import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import { Migration } from './types';
import { migration001BaselineTracking } from './migrations/001_baseline_tracking';
import { migration002MissingOperationalTables } from './migrations/002_missing_operational_tables';
import { migration003CanonicalWalkInUniqueness } from './migrations/003_canonical_walk_in_uniqueness';
import { migration004SyncSettingsRetentionTracking } from './migrations/004_sync_settings_retention_tracking';
import { migration005ConsolidateF2AndRemoveMilkProductTransaction } from './migrations/005_consolidate_f2_and_remove_milk_product_transaction';
import { migration006TechnicalRetentionAndMaintenance } from './migrations/006_technical_retention_and_maintenance';
import { migration007AddCloudUuidAndBackfill } from './migrations/007_add_cloud_uuid_and_backfill';
import { migration008RemoveRuntimeMappingDependency } from './migrations/008_remove_runtime_mapping_dependency';
import { migration009DropLocalToCloudMapping } from './migrations/009_drop_local_to_cloud_mapping';
import { migration010DropLegacyAppMigrations } from './migrations/010_drop_legacy_app_migrations';
import { migration011ReportPerformanceIndexes } from './migrations/011_report_performance_indexes';
import { migration012POSConfigColumns } from './migrations/012_pos_config_columns';
import { migration013InventoryProductSellPrice } from './migrations/013_inventory_product_sell_price';
import { migration014PerformanceAndLedgerIndexes } from './migrations/014_performance_and_ledger_indexes';
import { migration015ExpenseAndReportIndexes } from './migrations/015_expense_and_report_indexes';
import { migration016PosTokenIndex } from './migrations/016_pos_token_index';
import { migration017FixPosRfc3339Timestamps } from './migrations/017_fix_pos_rfc3339_timestamps';
import { migration018AddExpenseType } from './migrations/018_add_expense_type';
import { migration019AddSaleDiscountAndTokenColumns } from './migrations/019_add_sale_discount_and_token_columns';
import { migration020AddSaleCreatedBy } from './migrations/020_add_sale_created_by';

export const ALL_MIGRATIONS: Migration[] = [
  migration001BaselineTracking,
  migration002MissingOperationalTables,
  migration003CanonicalWalkInUniqueness,
  migration004SyncSettingsRetentionTracking,
  migration005ConsolidateF2AndRemoveMilkProductTransaction,
  migration006TechnicalRetentionAndMaintenance,
  migration007AddCloudUuidAndBackfill,
  migration008RemoveRuntimeMappingDependency,
  migration009DropLocalToCloudMapping,
  migration010DropLegacyAppMigrations,
  migration011ReportPerformanceIndexes,
  migration012POSConfigColumns,
  migration013InventoryProductSellPrice,
  migration014PerformanceAndLedgerIndexes,
  migration015ExpenseAndReportIndexes,
  migration016PosTokenIndex,
  migration017FixPosRfc3339Timestamps,
  migration018AddExpenseType,
  migration019AddSaleDiscountAndTokenColumns,
  migration020AddSaleCreatedBy,
];

export interface PreparedMigration {
  pending: boolean;
  databasePath: string;
  backupPath?: string;
  pendingMigrations: Migration[];
}

export function resolveDatabasePath(): string {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith('file:')) {
    throw new Error('[MIGRATION] SQLite DATABASE_URL starting with "file:" is required');
  }
  const cleanUrl = url.slice(5).split('?')[0];
  const raw = decodeURIComponent(cleanUrl.replace(/^['"]|['"]$/g, ''));
  if (path.isAbsolute(raw)) return path.normalize(raw);
  return path.resolve(process.cwd(), raw);
}

function backupDirectory(databasePath: string): string {
  if ((process as any).pkg) {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'com.shero.tauri-app', 'backups');
  }
  return path.join(path.dirname(databasePath), 'backups');
}

async function ensureMigrationTable(db: PrismaClient | Prisma.TransactionClient): Promise<void> {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AppMigration" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "version" INTEGER NOT NULL UNIQUE,
      "name" TEXT NOT NULL,
      "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "checksum" TEXT
    )
  `);
}

async function getAppliedVersions(db: PrismaClient): Promise<Set<number>> {
  try {
    await ensureMigrationTable(db);
    const rows: Array<{ version: number }> = await db.$queryRawUnsafe(
      `SELECT version FROM "AppMigration"`
    );
    return new Set(rows.map((r) => Number(r.version)));
  } catch (err) {
    return new Set();
  }
}

export async function createMigrationBackup(
  db: PrismaClient,
  databasePath: string
): Promise<string> {
  const dir = backupDirectory(databasePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(dir, `pos_before_migration_${stamp}.db`);

  // Use SQLite online VACUUM INTO for 100% consistent transactional file snapshot
  await db.$executeRawUnsafe(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

  if (!fs.existsSync(target)) {
    throw new Error(`[MIGRATION] Backup file was not created at: ${target}`);
  }

  const stat = fs.statSync(target);
  if (stat.size === 0) {
    throw new Error(`[MIGRATION] Backup file created at ${target} is 0 bytes!`);
  }

  const header = fs.readFileSync(target, { encoding: null }).subarray(0, 16).toString('utf8');
  if (header !== 'SQLite format 3\u0000') {
    throw new Error(`[MIGRATION] Backup file failed SQLite format header verification: ${target}`);
  }

  // Deep verification: Attach and run PRAGMA integrity_check on the snapshot
  try {
    await db.$executeRawUnsafe(`ATTACH DATABASE '${target.replace(/'/g, "''")}' AS backup_check;`);
    const checkRes = await db.$queryRawUnsafe<Array<{ integrity_check: string }>>(`PRAGMA backup_check.integrity_check;`);
    await db.$executeRawUnsafe(`DETACH DATABASE backup_check;`);
    if (!checkRes || checkRes[0]?.integrity_check !== 'ok') {
      throw new Error(`[MIGRATION] Backup failed integrity check: ${JSON.stringify(checkRes)}`);
    }
    console.log(`[MIGRATION] Verified backup integrity passed: ${target}`);
  } catch (err: any) {
    try { await db.$executeRawUnsafe(`DETACH DATABASE backup_check;`); } catch (_) {}
    throw new Error(`[MIGRATION] Backup integrity validation failed: ${err.message}`);
  }

  return target;
}

export async function preparePendingDataMigrations(
  db: PrismaClient,
  customDbPath?: string
): Promise<PreparedMigration> {
  const databasePath = customDbPath ? path.normalize(customDbPath) : resolveDatabasePath();
  console.log(`[MIGRATION] Database path: ${databasePath}`);

  if (!fs.existsSync(databasePath)) {
    console.log(`[MIGRATION] Database file does not exist yet at ${databasePath}. Will initialize fresh.`);
    return { pending: false, databasePath, pendingMigrations: [] };
  }

  const applied = await getAppliedVersions(db);
  const pending = ALL_MIGRATIONS.filter((m) => !applied.has(m.version)).sort(
    (a, b) => a.version - b.version
  );

  if (pending.length === 0) {
    console.log(`[MIGRATION] No pending migrations. All ${ALL_MIGRATIONS.length} migrations applied.`);
    return { pending: false, databasePath, pendingMigrations: [] };
  }

  for (const m of pending) {
    console.log(`[MIGRATION] Pending version: v${m.version} (${m.name})`);
  }

  const backupPath = await createMigrationBackup(db, databasePath);
  console.log(`[MIGRATION] Backup created: ${backupPath}`);

  return {
    pending: true,
    databasePath,
    backupPath,
    pendingMigrations: pending,
  };
}

async function verifySchemaIntegrity(tx: Prisma.TransactionClient): Promise<void> {
  const tables = await tx.$queryRawUnsafe<Array<{ name: string }>>(
    `SELECT name FROM sqlite_master WHERE type='table'`
  );
  const tableSet = new Set(tables.map((t) => t.name));

  const requiredTables = [
    'User',
    'Customer',
    'Sale',
    'SaleItem',
    'Payment',
    'Return',
    'ReturnItem',
    'Supplier',
    'SupplierCollection',
    'SupplierPayment',
    'InventoryProduct',
    'InventoryMovement',
    'Expense',
    'ExpensePayment',
    'Shift',
    'DailyRate',
    'MilkProductDailyStock',
    'ButterGheeConversion',
    'POSConfig',
    'DownstreamSyncState',
    'SyncQueue',
    'CashPerson',
    'CashbookTransaction',
    'Notification',
    'ActivityLog',
    'CloudSyncSettings',
    'AuditRecord',
    'HeldCart',
    'AppMigration',
  ];

  const missing = requiredTables.filter((t) => !tableSet.has(t));
  if (missing.length > 0) {
    throw new Error(`[MIGRATION] Schema verification failed. Missing tables: ${missing.join(', ')}`);
  }

  // Verify critical cloudUuid columns on major business tables
  const syncableTables = [
    'Customer',
    'Supplier',
    'InventoryProduct',
    'Sale',
    'SaleItem',
    'Payment',
    'Return',
    'ReturnItem',
    'InventoryMovement',
    'SupplierCollection',
    'SupplierPayment',
    'Expense',
    'Shift',
  ];

  for (const table of syncableTables) {
    const cols = await tx.$queryRawUnsafe<Array<{ name: string }>>(`PRAGMA table_info("${table}")`);
    const colSet = new Set(cols.map((c) => c.name));
    if (!colSet.has('cloudUuid')) {
      throw new Error(`[MIGRATION] Schema verification failed. Table "${table}" is missing "cloudUuid" column.`);
    }
  }

  // Verify canonical Walk-In single instance
  const walkIns = await tx.$queryRawUnsafe<Array<{ count: number }>>(
    `SELECT COUNT(*) as count FROM "Customer" WHERE "customerType" = 'walk_in'`
  );
  if (walkIns[0]?.count > 1) {
    throw new Error(`[MIGRATION] Schema verification failed. Multiple Walk-In customers detected (${walkIns[0].count}).`);
  }
}

// File-based cross-process migration lock for SQLite
class MigrationLock {
  private lockFilePath: string;
  private acquired = false;

  constructor(databasePath: string) {
    this.lockFilePath = `${databasePath}.migration.lock`;
  }

  async acquire(timeoutMs = 15000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        // wx flag: open for writing, fails if file already exists (atomic lock)
        fs.writeFileSync(this.lockFilePath, `${process.pid}\n${Date.now()}`, { flag: 'wx' });
        this.acquired = true;
        return;
      } catch (err: any) {
        if (err.code === 'EEXIST') {
          // Check if lock is stale (> 60 seconds)
          try {
            const stats = fs.statSync(this.lockFilePath);
            if (Date.now() - stats.mtimeMs > 60000) {
              console.warn('[MIGRATION] Breaking stale migration lock.');
              fs.unlinkSync(this.lockFilePath);
              continue;
            }
          } catch (_) { }
          // Wait 200ms and retry
          await new Promise((resolve) => setTimeout(resolve, 200));
        } else {
          throw err;
        }
      }
    }
    throw new Error(`[MIGRATION] Timeout waiting for migration lock: ${this.lockFilePath}`);
  }

  release(): void {
    if (this.acquired) {
      try {
        if (fs.existsSync(this.lockFilePath)) {
          // Retry unlinking on Windows in case of brief handle hold
          let unlinked = false;
          for (let i = 0; i < 5; i++) {
            try {
              fs.unlinkSync(this.lockFilePath);
              unlinked = true;
              break;
            } catch (err: any) {
              if (err.code === 'EBUSY' || err.code === 'EPERM') {
                const start = Date.now();
                while (Date.now() - start < 50) { } // Brief sleep
              } else {
                break;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[MIGRATION] Error releasing migration lock:', err);
      }
      this.acquired = false;
    }
  }
}

export async function runPendingDataMigrations(
  db: PrismaClient,
  prepared: PreparedMigration
): Promise<void> {
  if (!prepared.pending) return;

  const lock = new MigrationLock(prepared.databasePath);
  await lock.acquire();

  try {
    if (!prepared.backupPath || !fs.existsSync(prepared.backupPath)) {
      throw new Error('[MIGRATION] Aborting: Verified backup file is missing or unavailable.');
    }

    console.log(`[MIGRATION] Executing migration sequence within SQLite transaction...`);

    await db.$transaction(
      async (tx) => {
        // Ensure tracking table inside transaction
        await ensureMigrationTable(tx);

        for (const migration of prepared.pendingMigrations) {
          console.log(`[MIGRATION] Applying v${migration.version}: ${migration.name}...`);
          await migration.up(tx);

          const checksum = crypto
            .createHash('sha256')
            .update(`${migration.version}-${migration.name}`)
            .digest('hex')
            .slice(0, 16);

          await tx.$executeRawUnsafe(
            `INSERT INTO "AppMigration" ("version", "name", "appliedAt", "checksum")
             VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
            migration.version,
            migration.name,
            checksum
          );
          console.log(`[MIGRATION] Applied v${migration.version}: ${migration.name}`);
        }

        // Run comprehensive schema verification before committing transaction
        await verifySchemaIntegrity(tx);
        console.log(`[MIGRATION] Schema verification passed.`);
      },
      { timeout: 300_000 }
    );

    console.log(`[MIGRATION] All migrations committed successfully.`);
  } catch (error: any) {
    console.error(`[MIGRATION] Transaction failed and rolled back:`, error);
    throw error;
  } finally {
    lock.release();
  }
}
