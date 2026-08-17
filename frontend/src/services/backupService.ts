/**
 * backupService.ts
 *
 * Service layer for backup operations. Currently uses mock/local state.
 * Replace the implementations with Tauri invoke() calls when ready.
 */

import { BackupRecord } from '../types';

const BASE_PATH = 'C:\\Users\\HP\\OneDrive\\Documents\\RetailPOSBackup\\';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateTimestamp(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}Z`;
  return ts;
}

// --- Service functions ---

export async function createBackup(): Promise<BackupRecord> {
  // Simulate async backup process
  await delay(1500);

  const ts = generateTimestamp();
  const filename = `manual-backup-${ts}.db`;
  const newBackup: BackupRecord = {
    id: `backup-manual-${Date.now()}`,
    filename,
    path: `${BASE_PATH}${filename}`,
    createdAt: new Date().toISOString(),
    sizeKb: Math.floor(Math.random() * 900 + 300),
  };
  return newBackup;
}

export async function restoreBackup(_backup: BackupRecord): Promise<void> {
  // Simulate async restore process
  await delay(2000);
  // In real implementation: await invoke('restore_backup', { path: backup.path });
}

export async function openBackupFolder(): Promise<void> {
  // Stub — connect to Tauri filesystem API later
  // await invoke('open_path', { path: STORAGE_INFO.backupPath });
  throw new Error('Filesystem integration is not yet enabled.');
}

export function exportToExcel(backups: BackupRecord[]): void {
  // Generate a simple CSV that can be opened in Excel
  const header = 'Filename,Path,Created At,Size (KB)';
  const rows = backups.map(b =>
    `"${b.filename}","${b.path}","${b.createdAt}",${b.sizeKb}`
  );
  const csvContent = [header, ...rows].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-history-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(backups: BackupRecord[]): void {
  // Generate an HTML document and trigger the print dialog
  const rows = backups.map(b => `
    <tr>
      <td>${b.filename}</td>
      <td style="color:#555;font-size:12px">${b.path}</td>
      <td>${new Date(b.createdAt).toLocaleString()}</td>
      <td>${b.sizeKb} KB</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Backup History</title>
  <style>
    body { font-family: sans-serif; padding: 20px; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    p { color: #666; font-size: 13px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0; }
    td { padding: 8px; border-bottom: 1px solid #e2e8f0; word-break: break-all; }
  </style>
</head>
<body>
  <h1>Backup History</h1>
  <p>Gujar Milk Shop — Exported on ${new Date().toLocaleString()}</p>
  <table>
    <thead><tr><th>Filename</th><th>Path</th><th>Created At</th><th>Size</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;

  const w = window.open('', '_blank');
  if (w) {
    w.document.write(html);
    w.document.close();
    w.print();
  }
}
