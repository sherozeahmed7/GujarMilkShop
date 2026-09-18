import fs from 'fs';
import path from 'path';
import os from 'os';

export interface AutoBackupSettings {
  enabled: boolean;
  schedule: string;
  time: string;
  retention: string;
}

export interface BackupConfig {
  backupFolder: string | null;
  autoBackupSettings: AutoBackupSettings;
}

const DEFAULT_CONFIG: BackupConfig = {
  backupFolder: null,
  autoBackupSettings: {
    enabled: false,
    schedule: 'Daily',
    time: '02:00',
    retention: '30'
  }
};

function getConfigFilePath(): string {
  if ((process as any).pkg) {
    const appData = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'com.shero.tauri-app', 'backup_config.json');
  } else {
    return path.join(process.cwd(), 'prisma', 'backup_config.json');
  }
}

export function getBackupConfig(): BackupConfig {
  const configPath = getConfigFilePath();
  if (fs.existsSync(configPath)) {
    try {
      const data = fs.readFileSync(configPath, 'utf8');
      const parsed = JSON.parse(data);
      return { ...DEFAULT_CONFIG, ...parsed, autoBackupSettings: { ...DEFAULT_CONFIG.autoBackupSettings, ...(parsed.autoBackupSettings || {}) } };
    } catch (e) {
      console.error('[BackupConfig] Error reading config file', e);
    }
  }
  return { ...DEFAULT_CONFIG };
}

export function saveBackupConfig(config: BackupConfig): void {
  const configPath = getConfigFilePath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (e) {
    console.error('[BackupConfig] Error saving config file', e);
  }
}
