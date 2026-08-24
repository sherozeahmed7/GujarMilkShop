export interface BackupRecord {
  id: string;
  filename: string;
  path: string;
  createdAt: string; // ISO timestamp
  sizeKb: number;
  type: 'Auto' | 'Manual';
}

export interface AutoBackupSettings {
  enabled: boolean;
  schedule: string;
  time: string;
  retention: string;
}
