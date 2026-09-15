/**
 * Emergency recovery: Reset stuck SYNCING events back to PENDING.
 * These events have been in SYNCING state for >5 minutes and need to be
 * re-queued for retry. The sync worker normally handles this, but if the
 * worker was not running, events stay stuck indefinitely.
 *
 * SAFE: Only resets SYNCING -> PENDING. Does not touch SYNCED/FAILED.
 * SAFE: Only affects events older than 5 minutes.
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const stuckEvents = await p.syncQueue.findMany({
    where: {
      status: 'SYNCING',
      updatedAt: { lt: fiveMinutesAgo }
    },
    select: { eventUuid: true, entityType: true, operation: true, updatedAt: true }
  });

  console.log(`Found ${stuckEvents.length} stuck SYNCING events`);
  stuckEvents.forEach(e => {
    const age = ((Date.now() - e.updatedAt.getTime()) / 60000).toFixed(1);
    console.log(`  [${e.entityType}] ${e.operation} - stuck ${age} min`);
  });

  if (stuckEvents.length === 0) {
    console.log('No stuck events found. Nothing to do.');
    await p.$disconnect();
    return;
  }

  const result = await p.syncQueue.updateMany({
    where: {
      status: 'SYNCING',
      updatedAt: { lt: fiveMinutesAgo }
    },
    data: {
      status: 'PENDING',
      error: 'Reset from stuck SYNCING state (backend crash recovery)'
    }
  });

  console.log(`\nReset ${result.count} events from SYNCING -> PENDING`);
  console.log('The sync worker will now retry these events on its next cycle.');

  await p.$disconnect();
}

main().catch(e => { console.error(e.message); p.$disconnect(); });
