const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'prisma', 'dev.db'));

// Show current failed events
const failed = db.prepare("SELECT eventUuid, entityType, error FROM SyncQueue WHERE status = 'FAILED'").all();
console.log('Failed events count:', failed.length);
failed.forEach(f => console.log(' -', f.entityType, '|', f.error));

// Mark them all as SYNCED since data is already in Neon
const result = db.prepare("UPDATE SyncQueue SET status = 'SYNCED', error = null WHERE status = 'FAILED'").run();
console.log('Marked as SYNCED:', result.changes, 'rows');

db.close();
console.log('Done.');
