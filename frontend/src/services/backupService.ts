import { BackupRecord } from '../types';

const BACKUP_API = 'http://localhost:5000/api/backup';

/**
 * Wraps fetch with consistent network error handling.
 * Throws a user-friendly error if the server is unreachable or returns an error.
 */
async function backupFetch(input: RequestInfo, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (networkErr: any) {
    throw new Error('Cannot reach the local server. Please ensure the application backend is running.');
  }
  return response;
}

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.json();
    return data?.error || `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function listBackups(): Promise<{ backups: BackupRecord[], summary: any }> {
  const response = await backupFetch(BACKUP_API);
  if (!response.ok) {
    const msg = await parseErrorMessage(response);
    throw new Error(msg);
  }
  return response.json();
}

export async function createBackup(): Promise<BackupRecord> {
  const response = await backupFetch(BACKUP_API, { method: 'POST' });
  if (!response.ok) {
    const msg = await parseErrorMessage(response);
    throw new Error(msg);
  }
  const data = await response.json();
  if (!data?.backup) throw new Error('Server returned an unexpected response for backup creation.');
  return data.backup;
}

export async function restoreBackup(filename: string): Promise<void> {
  const response = await backupFetch(`${BACKUP_API}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename })
  });
  if (!response.ok) {
    const msg = await parseErrorMessage(response);
    throw new Error(msg);
  }
}

export async function restoreBackupFromFile(absolutePath: string): Promise<void> {
  if (!absolutePath || absolutePath.trim() === '') {
    throw new Error('No file path provided for restore.');
  }
  const response = await backupFetch(`${BACKUP_API}/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ absolutePath })
  });
  if (!response.ok) {
    const msg = await parseErrorMessage(response);
    throw new Error(msg);
  }
}

export async function openBackupFolder(): Promise<void> {
  const response = await backupFetch(`${BACKUP_API}/open-folder`, { method: 'POST' });
  if (!response.ok) {
    const msg = await parseErrorMessage(response);
    throw new Error(msg);
  }
}

export async function deleteBackup(filename: string): Promise<void> {
  if (!filename) throw new Error('No filename specified for deletion.');
  const response = await backupFetch(`${BACKUP_API}/${encodeURIComponent(filename)}`, { method: 'DELETE' });
  if (!response.ok) {
    const msg = await parseErrorMessage(response);
    throw new Error(msg);
  }
}

export function exportToExcel(backups: BackupRecord[]): void {
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

export async function getBackupSettings(): Promise<import('../types').AutoBackupSettings> {
  return { enabled: true, schedule: 'Daily', time: '02:00', retention: '30' };
}

export async function updateBackupSettings(_settings: Partial<import('../types').AutoBackupSettings>): Promise<void> {
  // Not implemented in backend yet — stubbed
}
