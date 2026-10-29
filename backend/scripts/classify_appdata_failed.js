const { PrismaClient } = require('@prisma/client');
const path = require('path');
const os = require('os');

// Force AppData pos.db
const appDataDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.shero.tauri-app', 'pos.db');
process.env.DATABASE_URL = `file:${appDataDbPath}?connection_limit=1&socket_timeout=3`;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: `file:${appDataDbPath}?connection_limit=1&socket_timeout=3`
    }
  }
});

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
      operation: true,
    },
    orderBy: [{ layer: 'asc' }, { entityType: 'asc' }]
  });

  console.log(`\n=== TOTAL FAILED EVENTS IN APPDATA POS.DB: ${failed.length} ===\n`);

  // Group by entityType
  const byType = {};
  for (const e of failed) {
    if (!byType[e.entityType]) byType[e.entityType] = [];
    byType[e.entityType].push(e);
  }

  console.log('=== FAILED BY ENTITY TYPE ===');
  for (const [type, events] of Object.entries(byType)) {
    console.log(`\n${type}: ${events.length} events`);
    const errors = {};
    for (const e of events) {
      const err = (e.error || 'no error').trim();
      errors[err] = (errors[err] || 0) + 1;
    }
    for (const [err, cnt] of Object.entries(errors)) {
      console.log(`  [${cnt}x] Error: ${err}`);
    }
  }

  // Group by Layer
  console.log('\n=== LAYER DISTRIBUTION ===');
  const byLayer = {};
  for (const e of failed) {
    byLayer[e.layer] = (byLayer[e.layer] || 0) + 1;
  }
  for (const [layer, cnt] of Object.entries(byLayer)) {
    console.log(`  Layer ${layer}: ${cnt} events`);
  }

  // Group by Retry Count
  console.log('\n=== RETRY COUNT DISTRIBUTION ===');
  const byRetry = {};
  for (const e of failed) {
    byRetry[e.retryCount] = (byRetry[e.retryCount] || 0) + 1;
  }
  for (const [rc, cnt] of Object.entries(byRetry)) {
    console.log(`  retryCount=${rc}: ${cnt} events`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
