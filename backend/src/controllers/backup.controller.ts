import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { prisma } from '../config/database';
import { isRestoreInProgress, setRestoreInProgress } from '../utils/restoreLock';
import { exec } from 'child_process';
import { getBackupConfig, saveBackupConfig, BackupConfig } from '../utils/backupConfig';

/**
 * Helper to get the correct backup directory for both dev and production.
 */
function getBackupDirectory(): string {
  const config = getBackupConfig();
  if (config.backupFolder) {
    // If a custom folder is defined, try to use it
    try {
      if (!fs.existsSync(config.backupFolder)) {
        fs.mkdirSync(config.backupFolder, { recursive: true });
      }
      return config.backupFolder;
    } catch (e) {
      console.error('[Backup] Custom backup directory invalid, falling back to default:', e);
    }
  }

  let backupDir: string;
  if ((process as any).pkg) {
    const appData = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
    backupDir = path.join(appData, 'com.shero.tauri-app', 'backups');
  } else {
    backupDir = path.join(process.cwd(), 'prisma', 'backups');
  }

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
  } catch (err: any) {
    throw new Error(`Could not access or create backup directory at ${backupDir}. Permission denied or disk full.`);
  }

  return backupDir;
}

/**
 * Validate that a file is a real SQLite database by checking the 16-byte magic header.
 */
function isValidSqliteFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(16);
    const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);
    if (bytesRead < 16) return false;
    // SQLite3 magic header: "SQLite format 3\0"
    return buffer.toString('utf8', 0, 15) === 'SQLite format 3';
  } catch {
    return false;
  }
}

/**
 * Create a new SQLite backup via VACUUM INTO
 */
export async function createBackup(req: Request, res: Response): Promise<void> {
  try {
    const backupDir = getBackupDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFilename = `manual-backup-${timestamp}.db`;
    const targetPath = path.join(backupDir, backupFilename);

    // Force WAL flush — use $queryRawUnsafe since PRAGMA returns result rows
    try {
      await prisma.$queryRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE)`);
    } catch (e: any) {
      console.warn('[Backup] wal_checkpoint warning:', e.message);
    }

    const escapedPath = targetPath.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedPath}'`);

    if (!fs.existsSync(targetPath)) {
      throw new Error('Backup file was not created. The database may be locked or disk may be full.');
    }

    const stat = fs.statSync(targetPath);
    if (stat.size === 0) {
      fs.unlinkSync(targetPath); // clean up empty file
      throw new Error('Backup file is empty. The database may be locked or inaccessible.');
    }

    // Validate the backup is a real SQLite file
    if (!isValidSqliteFile(targetPath)) {
      try { fs.unlinkSync(targetPath); } catch { }
      throw new Error('Backup file was created but failed SQLite validation. The output may be corrupted.');
    }

    res.json({
      message: 'Backup created successfully',
      backup: {
        id: backupFilename,
        filename: backupFilename,
        path: targetPath,
        createdAt: stat.birthtime.toISOString(),
        sizeKb: Math.round(stat.size / 1024),
        type: 'Manual',
      }
    });
  } catch (err: any) {
    const safeMsg = err.message || 'Failed to create backup';
    console.error('[Backup Error]', safeMsg, err.code ?? '');
    res.status(500).json({ error: safeMsg });
  }
}


/**
 * List all backups in the directory
 */
export async function listBackups(req: Request, res: Response): Promise<void> {
  try {
    const backupDir = getBackupDirectory();
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
    
    let totalStorage = 0;
    const backups = files.map(filename => {
      try {
        const filePath = path.join(backupDir, filename);
        const stat = fs.statSync(filePath);
        const sizeKb = Math.round(stat.size / 1024);
        totalStorage += sizeKb;
        
        const type = filename.startsWith('auto-') ? 'Auto' : 
                     filename.startsWith('pos_pre_') ? 'System' : 'Manual';

        return {
          id: filename,
          filename,
          path: filePath,
          createdAt: stat.mtime.toISOString(),
          sizeKb,
          type,
        };
      } catch (e) {
        return null;
      }
    }).filter((b) => b !== null) as any[];

    // Sort newest first
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    res.json({
      backups,
      summary: {
        totalBackups: backups.length,
        latestBackup: backups.length > 0 ? backups[0].createdAt : null,
        totalStorageKb: totalStorage,
        status: backups.length > 0 ? 'Healthy' : 'No Backups',
      }
    });
  } catch (err: any) {
    console.error('[List Backups Error]', err);
    res.status(500).json({ error: err.message || 'Failed to list backups' });
  }
}

/**
 * Delete a specific backup file
 */
export async function deleteBackup(req: Request, res: Response): Promise<void> {
  try {
    const { filename } = req.params;
    if (!filename || filename.includes('/') || filename.includes('\\') || filename === 'pos.db') {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    const backupDir = getBackupDirectory();
    const targetPath = path.join(backupDir, filename);

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      res.json({ message: 'Backup deleted successfully' });
    } else {
      res.status(404).json({ error: 'Backup file not found' });
    }
  } catch (err: any) {
    console.error('[Delete Backup Error]', err);
    res.status(500).json({ error: err.message || 'Failed to delete backup' });
  }
}

/**
 * Open the backup folder in Windows Explorer
 */
export async function openFolder(req: Request, res: Response): Promise<void> {
  try {
    const backupDir = getBackupDirectory();
    if (os.platform() === 'win32') {
      exec(`start "" "${backupDir}"`);
      res.json({ message: 'Folder opened' });
    } else {
      res.status(400).json({ error: 'Only supported on Windows' });
    }
  } catch (err: any) {
    console.error('[Open Folder Error]', err);
    res.status(500).json({ error: err.message || 'Failed to open folder' });
  }
}

export async function downloadBackup(req: Request, res: Response): Promise<void> {
  try {
    const { filename } = req.params;
    if (!filename || filename.includes('/') || filename.includes('\\') || filename === 'pos.db') {
      res.status(400).json({ error: 'Invalid filename' });
      return;
    }

    const backupDir = getBackupDirectory();
    const targetPath = path.join(backupDir, filename);

    if (fs.existsSync(targetPath)) {
      res.download(targetPath);
    } else {
      res.status(404).json({ error: 'Backup file not found' });
    }
  } catch (err: any) {
    console.error('[Download Backup Error]', err);
    res.status(500).json({ error: err.message || 'Failed to download backup' });
  }
}

export async function restoreBackup(req: Request, res: Response): Promise<void> {
  const { filename, absolutePath } = req.body;

  if (isRestoreInProgress()) {
    res.status(409).json({ error: 'A restore operation is already in progress.' });
    return;
  }

  let sourceBackupPath = '';

  try {
    const backupDir = getBackupDirectory();

    if (absolutePath) {
      sourceBackupPath = absolutePath;
    } else if (filename) {
      if (filename.includes('/') || filename.includes('\\') || filename === 'pos.db') {
        res.status(400).json({ error: 'Invalid backup filename provided.' });
        return;
      }
      sourceBackupPath = path.join(backupDir, filename);
    } else {
      res.status(400).json({ error: 'Must provide filename or absolutePath.' });
      return;
    }

    if (!fs.existsSync(sourceBackupPath)) {
      res.status(404).json({ error: 'Backup file not found.' });
      return;
    }
  } catch (err: any) {
    res.status(500).json({ error: `Failed to locate backup: ${err.message}` });
    return;
  }

  setRestoreInProgress(true);
  
  let currentDbPath: string;
  if ((process as any).pkg) {
    const appData = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
    currentDbPath = path.join(appData, 'com.shero.tauri-app', 'pos.db');
  } else {
    currentDbPath = path.join(process.cwd(), 'prisma', 'pos.db');
  }

  let safetyBackupPath = '';
  let didDisconnect = false;

  try {
    // 0a. Fast magic-header check — rejects text files renamed to .db immediately
    if (!isValidSqliteFile(sourceBackupPath)) {
      res.status(400).json({ error: 'The selected file is not a valid SQLite database. Please choose a valid .db backup file.' });
      setRestoreInProgress(false);
      return;
    }

    // 0b. Deep integrity check using a disposable PrismaClient
    const { PrismaClient } = require('@prisma/client');
    const sourceDbUrl = `file:${sourceBackupPath}`;
    const validatorClient = new PrismaClient({ datasources: { db: { url: sourceDbUrl } } });
    
    try {
      const integrityCheck: any = await validatorClient.$queryRawUnsafe(`PRAGMA integrity_check`);
      const isOk = integrityCheck && integrityCheck.length > 0 && integrityCheck[0].integrity_check === 'ok';
      if (!isOk) {
        throw new Error('Source database failed integrity check — the backup may be corrupted or incomplete.');
      }
    } finally {
      await validatorClient.$disconnect();
    }

    // 1. Create safety backup
    const backupDir = getBackupDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    safetyBackupPath = path.join(backupDir, `pos_pre_local_restore_${timestamp}.db`);
    
    try {
      await prisma.$queryRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE)`);
    } catch (e: any) {
      console.warn('[Restore] wal_checkpoint warning on safety backup:', e.message);
    }
    
    const escapedSafetyPath = safetyBackupPath.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedSafetyPath}'`);
    
    if (!fs.existsSync(safetyBackupPath) || fs.statSync(safetyBackupPath).size === 0) {
      throw new Error("Failed to create safety backup of the current database.");
    }

    // 2. Disconnect Prisma
    await prisma.$disconnect();
    didDisconnect = true;

    // 3. Replace pos.db safely
    const walPath = `${currentDbPath}-wal`;
    const shmPath = `${currentDbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    fs.copyFileSync(sourceBackupPath, currentDbPath);

    // 4. Reconnect and apply all migrations, schema updates, and performance optimizations
    await prisma.$connect();
    didDisconnect = false;

    // Run versioned schema and data migrations against the restored database
    const { preparePendingDataMigrations, runPendingDataMigrations } = await import('../migrations/migrationRunner');
    const preparedMigrations = await preparePendingDataMigrations(prisma, currentDbPath);
    await runPendingDataMigrations(prisma, preparedMigrations);

    // Apply query optimization and indexes on restored data
    try {
      await prisma.$queryRawUnsafe(`PRAGMA optimize;`);
    } catch {
      // Non-fatal
    }

    await prisma.user.count();

    res.json({ message: 'Database restored and upgraded successfully.', safetyBackup: safetyBackupPath });
  } catch (err: any) {
    console.error('[Restore Error]', err);

    let rollbackSuccess = false;
    let rollbackError = '';

    // Automatic rollback
    if (didDisconnect && safetyBackupPath && fs.existsSync(safetyBackupPath)) {
      try {
        console.warn(`[Restore Rollback] Attempting to rollback to ${safetyBackupPath}`);
        
        // Ensure disconnected
        try { await prisma.$disconnect(); } catch (e) { }
        
        const walPath = `${currentDbPath}-wal`;
        const shmPath = `${currentDbPath}-shm`;
        if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
        if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

        fs.copyFileSync(safetyBackupPath, currentDbPath);

        await prisma.$connect();
        await prisma.user.count(); // health check
        rollbackSuccess = true;
      } catch (rbErr: any) {
        rollbackError = rbErr.message;
        console.error('[CRITICAL] Restore rollback failed!', rbErr);
      }
    } else if (!didDisconnect) {
      // If we never disconnected, we just stay connected
      rollbackSuccess = true;
    }

    if (!rollbackSuccess && didDisconnect) {
      res.status(500).json({ 
        error: `CRITICAL ERROR: Restore failed (${err.message}) AND rollback failed (${rollbackError}). Database may be inaccessible.`,
        safetyBackup: safetyBackupPath 
      });
    } else {
      res.status(500).json({ 
        error: `Restore failed: ${err.message}. Changes were safely rolled back.`, 
        safetyBackup: safetyBackupPath 
      });
    }
  } finally {
    setRestoreInProgress(false);
  }
}

export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    const config = getBackupConfig();
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to get backup settings' });
  }
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    const newConfig: Partial<BackupConfig> = req.body;
    const currentConfig = getBackupConfig();
    const updatedConfig = { ...currentConfig, ...newConfig, autoBackupSettings: { ...currentConfig.autoBackupSettings, ...(newConfig.autoBackupSettings || {}) } };
    saveBackupConfig(updatedConfig);
    res.json(updatedConfig);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update backup settings' });
  }
}
