import fs from 'fs';
import path from 'path';
import { prisma } from '../config/database';
import { getBackupConfig } from '../utils/backupConfig';

let autoBackupTimer: NodeJS.Timeout | null = null;

function getBackupDirectory(): string {
  const config = getBackupConfig();
  if (config.backupFolder) {
    if (fs.existsSync(config.backupFolder)) {
      return config.backupFolder;
    }
  }

  let backupDir: string;
  if ((process as any).pkg) {
    const os = require('os');
    const appData = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
    backupDir = path.join(appData, 'com.shero.tauri-app', 'backups');
  } else {
    backupDir = path.join(process.cwd(), 'prisma', 'backups');
  }
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  return backupDir;
}

export function startAutoBackupWorker() {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
  }

  // Check every minute if a backup needs to be created
  autoBackupTimer = setInterval(async () => {
    const config = getBackupConfig();
    if (!config.autoBackupSettings.enabled) return;

    const now = new Date();
    const currentHourStr = now.getHours().toString().padStart(2, '0');
    const currentMinuteStr = now.getMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHourStr}:${currentMinuteStr}`;

    // Normalize schedule time format (e.g. "02:00" vs "2:00")
    const targetTime = config.autoBackupSettings.time?.trim() || '';
    const normalizedTarget = targetTime.includes(':')
      ? targetTime.split(':').map((p: string) => p.padStart(2, '0')).join(':')
      : targetTime;

    if (currentTimeStr === normalizedTarget) {
      const backupDir = getBackupDirectory();
      
      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, '0');
      const date = now.getDate().toString().padStart(2, '0');
      const localDateStr = `${year}-${month}-${date}`;
      const dayOfWeek = now.getDay(); // 0 (Sun) to 6 (Sat)
      const dateOfMonth = now.getDate(); // 1 to 31

      // Handle schedule type
      if (config.autoBackupSettings.schedule === 'Weekly' && dayOfWeek !== 0) {
        // Weekly runs on Sunday (0)
        return;
      }
      
      if (config.autoBackupSettings.schedule === 'Monthly' && dateOfMonth !== 1) {
        // Monthly runs on the 1st of the month
        return;
      }

      // Determine if a backup already exists for this schedule period today
      const backupPrefix = `auto-backup-${localDateStr}`;
      
      const files = fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [];
      const alreadyBackedUp = files.some(f => f.startsWith(backupPrefix));
      
      if (!alreadyBackedUp) {
        try {
          console.log('[AutoBackup] Starting scheduled backup...');
          const hours = now.getHours().toString().padStart(2, '0');
          const minutes = now.getMinutes().toString().padStart(2, '0');
          const seconds = now.getSeconds().toString().padStart(2, '0');
          const backupFilename = `auto-backup-${localDateStr}T${hours}-${minutes}-${seconds}.db`;
          const targetPath = path.join(backupDir, backupFilename);

          try {
            await prisma.$queryRawUnsafe(`PRAGMA wal_checkpoint(TRUNCATE)`);
          } catch (e: any) {
             // Ignore
          }
          
          const escapedPath = targetPath.replace(/'/g, "''");
          await prisma.$executeRawUnsafe(`VACUUM INTO '${escapedPath}'`);
          console.log(`[AutoBackup] Successfully created backup at ${targetPath}`);

          // Handle retention
          handleRetention(backupDir, config.autoBackupSettings.retention);

        } catch (error: any) {
          console.error('[AutoBackup] Error creating scheduled backup:', error);
          const { NotificationService } = require('../services/notification.service');
          NotificationService.create({
            category: 'backup',
            title: 'Backup Failed',
            message: `Scheduled local database backup failed: ${error?.message || 'Unknown error'}.`,
            actionUrl: '/settings/local-backup',
            actionLabel: 'Backup Now',
            metadata: { error: error?.message },
            dedupeHours: 6,
          }).catch(() => {});
        }
      }
    }
  }, 60000); // Check every minute
}

export function handleRetention(backupDir: string, retentionStr: string) {
  if (!retentionStr || retentionStr === 'all') return;
  
  const keepCount = parseInt(retentionStr, 10);
  if (isNaN(keepCount) || keepCount <= 0) return;

  if (!fs.existsSync(backupDir)) return;

  const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db') && (f.startsWith('auto-') || f.startsWith('manual-')));
  if (files.length <= keepCount) return;

  // Sort by modification time, newest first
  const fileStats = files.map(f => {
    const filePath = path.join(backupDir, f);
    return { path: filePath, mtime: fs.statSync(filePath).mtime.getTime() };
  }).sort((a, b) => b.mtime - a.mtime);

  // Delete older files beyond keepCount
  const filesToDelete = fileStats.slice(keepCount);
  for (const file of filesToDelete) {
    try {
      fs.unlinkSync(file.path);
      console.log(`[AutoBackup] Deleted old backup per retention limit (${keepCount}): ${file.path}`);
    } catch (e) {
      console.error(`[AutoBackup] Failed to delete old backup: ${file.path}`, e);
    }
  }
}
