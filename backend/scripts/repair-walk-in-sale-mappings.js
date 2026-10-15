require('dotenv').config();
const path = require('path');
const os = require('os');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');

const EXECUTE = process.argv.includes('--execute');
const CANONICAL = '00000000-0000-4000-8000-000000000001';
const dbPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'com.shero.tauri-app', 'pos.db');
const sqlite = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const neon = new Pool({ connectionString: process.env.NEON_DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const events = await sqlite.syncQueue.findMany({
    where: { entityType: 'Sale', operation: 'UPDATE', status: 'PENDING', payload: { contains: CANONICAL } },
    select: { eventUuid: true, deviceId: true, localId: true, cloudUuid: true },
  });
  const localIds = events.map((e) => e.localId);
  const mappings = await sqlite.localToCloudMapping.findMany({
    where: { entityType: 'Sale', localId: { in: localIds } },
  });
  const candidates = [...new Set(mappings.map((m) => m.cloudUuid))];
  const existing = await neon.query(`SELECT id::text FROM sales WHERE id=ANY($1::uuid[])`, [candidates]);
  const existingIds = new Set(existing.rows.map((r) => r.id));
  const repairs = [];
  const unresolved = [];
  const ambiguous = [];
  for (const event of events) {
    const valid = [...new Set(mappings.filter((m) => m.localId === event.localId && existingIds.has(m.cloudUuid)).map((m) => m.cloudUuid))];
    if (valid.length === 1) repairs.push({ ...event, targetUuid: valid[0] });
    else if (valid.length === 0) unresolved.push(event.localId);
    else ambiguous.push({ localId: event.localId, valid });
  }
  const summary = { mode: EXECUTE ? 'execute' : 'dry-run', pendingEvents: events.length, repairable: repairs.length, unresolved: unresolved.length, ambiguous: ambiguous.length };
  if (!EXECUTE) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }
  if (ambiguous.length) throw new Error(`Refusing ambiguous mappings: ${JSON.stringify(ambiguous.slice(0, 5))}`);

  const backupPath = path.join(path.dirname(dbPath), `pos-pre-sale-mapping-repair-${new Date().toISOString().replace(/[:.]/g, '-')}.db`);
  await sqlite.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);
  await sqlite.$transaction(async (tx) => {
    for (const repair of repairs) {
      await tx.localToCloudMapping.update({
        where: { deviceId_entityType_localId: { deviceId: repair.deviceId, entityType: 'Sale', localId: repair.localId } },
        data: { cloudUuid: repair.targetUuid },
      });
      await tx.syncQueue.update({ where: { eventUuid: repair.eventUuid }, data: { cloudUuid: repair.targetUuid } });
    }
    if (unresolved.length) {
      await tx.syncQueue.updateMany({
        where: { entityType: 'Sale', localId: { in: unresolved }, operation: 'UPDATE', status: 'PENDING' },
        data: {
          status: 'FAILED',
          error: 'HISTORICAL_SALE_IDENTITY_UNRESOLVED_REVIEW_REQUIRED',
        },
      });
    }
  }, { timeout: 300_000 });
  console.log(JSON.stringify({ ...summary, backupPath, repaired: repairs.length, quarantined: unresolved.length, unresolvedLocalIds: unresolved }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await sqlite.$disconnect(); await neon.end(); });
