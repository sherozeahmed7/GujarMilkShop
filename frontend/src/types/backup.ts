export interface BackupRecord {
  id: string;
  filename: string;
  path: string;
  createdAt: string; // ISO timestamp
  sizeKb: number;
}
