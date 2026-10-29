const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
require('dotenv').config();

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.shero.tauri-app', 'pos.db');

try {
  const db = new Database(dbPath, { readonly: true });

  const total = db.prepare("SELECT COUNT(*) as c FROM SyncQueue").get();
  const pending = db.prepare("SELECT COUNT(*) as c FROM SyncQueue WHERE status='PENDING'").get();
  const synced = db.prepare("SELECT COUNT(*) as c FROM SyncQueue WHERE status='SYNCED'").get();
  const failed = db.prepare("SELECT COUNT(*) as c FROM SyncQueue WHERE status='FAILED'").get();
  const syncing = db.prepare("SELECT COUNT(*) as c FROM SyncQueue WHERE status='SYNCING'").get();

  console.log('=== SyncQueue Stats ===');
  console.log('Total:', total.c);
  console.log('PENDING:', pending.c);
  console.log('SYNCED:', synced.c);
  console.log('FAILED:', failed.c);
  console.log('SYNCING:', syncing.c);

  const failedSamples = db.prepare("SELECT entityType, error, retryCount FROM SyncQueue WHERE status='FAILED' LIMIT 10").all();
  console.log('\n--- FAILED samples ---');
  failedSamples.forEach(r => console.log(JSON.stringify(r)));

  const oldestPending = db.prepare("SELECT entityType, cloudUuid, createdAt, nextRetryAt, retryCount FROM SyncQueue WHERE status='PENDING' ORDER BY createdAt ASC LIMIT 5").all();
  console.log('\n--- Oldest PENDING ---');
  oldestPending.forEach(r => console.log(JSON.stringify(r)));

  // Check CloudSyncSettings
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
  if (tables.includes('CloudSyncSettings')) {
    const settings = db.prepare("SELECT * FROM CloudSyncSettings WHERE id=1").get();
    console.log('\n--- CloudSyncSettings ---');
    console.log(JSON.stringify(settings));
  } else {
    console.log('\nCloudSyncSettings table NOT FOUND');
  }

  // Local record counts
  const customers = db.prepare("SELECT COUNT(*) as c FROM Customer").get();
  const sales = db.prepare("SELECT COUNT(*) as c FROM Sale").get();
  console.log('\n--- Local SQLite counts ---');
  console.log('Customer:', customers.c, '| Sale:', sales.c);

  db.close();
} catch(e) {
  console.error('Error:', e.message);
}
