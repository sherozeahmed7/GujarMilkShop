// Step 1: Classify all FAILED events in the SyncQueue
// Groups by entityType + error message + retryCount
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const failed = await prisma.syncQueue.findMany({
    where: { status: 'FAILED' },
    select: {
      eventUuid: true,
      entityType: true,
      error: true,
      retryCount: true,
      cloudUuid: true,
      localId: true,
      deviceId: true,
      layer: true,
      createdAt: true,
      payload: true,
    },
    orderBy: [{ layer: 'asc' }, { entityType: 'asc' }]
  });

  console.log(`\n=== TOTAL FAILED EVENTS: ${failed.length} ===\n`);

  // Group by entityType
  const byType: Record<string, any[]> = {};
  for (const e of failed) {
    if (!byType[e.entityType]) byType[e.entityType] = [];
    byType[e.entityType].push(e);
  }

  // Group by entityType + error
  const byTypeError: Record<string, number> = {};
  for (const e of failed) {
    const key = `${e.entityType} | ${e.error || 'no error'}`;
    byTypeError[key] = (byTypeError[key] || 0) + 1;
  }

  console.log('=== FAILED BY ENTITY TYPE ===');
  for (const [type, events] of Object.entries(byType)) {
    console.log(`\n${type}: ${events.length} events`);
    // Show unique errors
    const errors: Record<string, number> = {};
    for (const e of events) {
      const err = (e.error || 'no error').substring(0, 120);
      errors[err] = (errors[err] || 0) + 1;
    }
    for (const [err, cnt] of Object.entries(errors)) {
      console.log(`  [${cnt}x] retryCount ${events.find(e => (e.error||'').includes(err.substring(0,20)))?.retryCount ?? '?'} | Error: ${err}`);
    }
  }

  console.log('\n\n=== FAILED BY TYPE+ERROR (summary) ===');
  for (const [key, cnt] of Object.entries(byTypeError).sort()) {
    console.log(`  [${cnt}x] ${key}`);
  }

  console.log('\n=== LAYER DISTRIBUTION ===');
  const byLayer: Record<number, number> = {};
  for (const e of failed) {
    byLayer[e.layer] = (byLayer[e.layer] || 0) + 1;
  }
  for (const [layer, cnt] of Object.entries(byLayer).sort()) {
    console.log(`  Layer ${layer}: ${cnt} events`);
  }

  console.log('\n=== RETRY COUNT DISTRIBUTION ===');
  const byRetry: Record<number, number> = {};
  for (const e of failed) {
    byRetry[e.retryCount] = (byRetry[e.retryCount] || 0) + 1;
  }
  for (const [rc, cnt] of Object.entries(byRetry).sort()) {
    console.log(`  retryCount=${rc}: ${cnt} events`);
  }

  // Check if any FAILED events have cloudUuids referenced by PENDING events
  const failedUuids = failed.map(e => e.cloudUuid);
  const pendingCount = await prisma.syncQueue.count({ where: { status: 'PENDING' } });
  console.log(`\n=== PENDING count (total): ${pendingCount} ===`);
  console.log(`Failed UUIDs that may be blocking dependents: ${failedUuids.length}`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
