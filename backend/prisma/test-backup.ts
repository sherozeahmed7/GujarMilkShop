/**
 * Local Backup Error Handling Test Suite
 * Run from the backend directory: npx ts-node prisma/test-backup.ts
 */
import fs from 'fs';
import path from 'path';
import os from 'os';

const BASE_URL = 'http://localhost:5000/api/backup';

async function apiFetch(url: string, init?: RequestInit): Promise<{ status: number; data: any }> {
  const res = await fetch(url, init);
  let data: any;
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, data };
}

function pass(label: string) { console.log(`  ✅ PASS: ${label}`); }
function fail(label: string, detail?: any) { console.error(`  ❌ FAIL: ${label}`, detail ?? ''); }

async function runTests() {
  console.log('\n══════════════════════════════════════════');
  console.log('  LOCAL BACKUP ERROR HANDLING TEST SUITE');
  console.log('══════════════════════════════════════════\n');

  let passCount = 0;
  let failCount = 0;

  async function test(label: string, fn: () => Promise<void>) {
    process.stdout.write(`  Testing: ${label} ... `);
    try {
      await fn();
      passCount++;
      console.log('✅ PASS');
    } catch (e: any) {
      failCount++;
      console.log(`❌ FAIL — ${e.message}`);
    }
  }

  // ── Test 1: Backup Now (success) ──────────────────────────────
  await test('Backup Now creates a valid backup', async () => {
    const { status, data } = await apiFetch(BASE_URL, { method: 'POST' });
    if (status !== 200) throw new Error(`Expected 200, got ${status}: ${data.error}`);
    if (!data.backup?.filename) throw new Error('No backup filename in response');
    if (!data.backup.sizeKb || data.backup.sizeKb === 0) throw new Error('Backup file is empty');
  });

  // ── Test 2: List backups ──────────────────────────────────────
  await test('List backups returns array and summary', async () => {
    const { status, data } = await apiFetch(BASE_URL);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!Array.isArray(data.backups)) throw new Error('backups is not an array');
    if (typeof data.summary.totalBackups !== 'number') throw new Error('Missing summary.totalBackups');
    if (data.summary.status !== 'Healthy' && data.summary.status !== 'No Backups') throw new Error('Unexpected status: ' + data.summary.status);
  });

  // ── Test 3: Reject invalid filename (path traversal) ─────────
  await test('Delete rejects path-traversal filenames', async () => {
    const { status, data } = await apiFetch(`${BASE_URL}/../pos.db`, { method: 'DELETE' });
    if (status === 200) throw new Error('Should have rejected traversal filename');
  });

  // ── Test 4: Delete non-existent file ─────────────────────────
  await test('Delete returns 404 for non-existent file', async () => {
    const { status, data } = await apiFetch(`${BASE_URL}/nonexistent-backup-fake.db`, { method: 'DELETE' });
    if (status !== 404) throw new Error(`Expected 404, got ${status}`);
  });

  // ── Test 5: Download non-existent file ───────────────────────
  await test('Download returns 404 for non-existent file', async () => {
    const { status } = await apiFetch(`${BASE_URL}/download/fake-backup-000.db`);
    if (status !== 404) throw new Error(`Expected 404, got ${status}`);
  });

  // ── Test 6: Restore rejects missing file ─────────────────────
  await test('Restore rejects missing backup file', async () => {
    const { status, data } = await apiFetch(`${BASE_URL}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'definitely-does-not-exist.db' })
    });
    if (status !== 404) throw new Error(`Expected 404, got ${status}: ${data.error}`);
  });

  // ── Test 7: Restore rejects missing body params ───────────────
  await test('Restore rejects empty body', async () => {
    const { status, data } = await apiFetch(`${BASE_URL}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    if (status !== 400) throw new Error(`Expected 400, got ${status}: ${data.error}`);
  });

  // ── Test 8: Restore rejects invalid (non-SQLite) file ────────
  await test('Restore rejects a text file masquerading as .db', async () => {
    // Create a fake .db file that is just plain text
    const fakeDbPath = path.join(os.tmpdir(), `fake-db-${Date.now()}.db`);
    fs.writeFileSync(fakeDbPath, 'This is not a SQLite database file, just plain text.');
    try {
      const { status, data } = await apiFetch(`${BASE_URL}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ absolutePath: fakeDbPath })
      });
      if (status === 200) throw new Error('Should have rejected non-SQLite file');
      if (!data.error?.toLowerCase().includes('sqlite') && !data.error?.toLowerCase().includes('valid')) {
        throw new Error(`Expected SQLite validation error, got: ${data.error}`);
      }
    } finally {
      try { fs.unlinkSync(fakeDbPath); } catch { }
    }
  });

  // ── Test 9: Restore rejects path-traversal absolutePath ──────
  await test('Restore rejects path-traversal in filename', async () => {
    const { status } = await apiFetch(`${BASE_URL}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: '../pos.db' })
    });
    if (status === 200) throw new Error('Should have rejected traversal filename');
  });

  // ── Test 10: Open folder (win32 only) ────────────────────────
  await test('Open backup folder responds', async () => {
    const { status } = await apiFetch(`${BASE_URL}/open-folder`, { method: 'POST' });
    // Either 200 (opened) or 400 (non-Windows) is acceptable
    if (status !== 200 && status !== 400) throw new Error(`Unexpected status: ${status}`);
  });

  // ── Summary ───────────────────────────────────────────────────
  console.log(`\n══════════════════════════════════════════`);
  console.log(`  RESULTS: ${passCount} passed, ${failCount} failed`);
  console.log(`══════════════════════════════════════════\n`);

  if (failCount > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('[Test Runner Error]', err.message);
  process.exit(1);
});
