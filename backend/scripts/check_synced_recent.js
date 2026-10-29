const { PrismaClient } = require('@prisma/client');
const path = require('path');
const os = require('os');

const appDataDbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'com.shero.tauri-app', 'pos.db');
const prisma = new PrismaClient({
  datasources: {
    db: { url: `file:${appDataDbPath}?connection_limit=1&socket_timeout=3` }
  }
});

async function main() {
  const syncedRecent = await prisma.syncQueue.findMany({
    where: { status: 'SYNCED' },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: {
      entityType: true,
      operation: true,
      cloudUuid: true,
      updatedAt: true,
      retryCount: true
    }
  });

  console.log('=== 20 MOST RECENTLY SYNCED EVENTS ===');
  syncedRecent.forEach(e => console.log(`${e.updatedAt.toISOString()} | ${e.entityType.padEnd(20)} | ${e.operation} | ${e.cloudUuid}`));

  const statusCounts = await prisma.$queryRawUnsafe('SELECT status, COUNT(*) as cnt FROM SyncQueue GROUP BY status;');
  console.log('\n=== CURRENT SYNCQUEUE BREAKDOWN ===');
  console.log(statusCounts);

  await prisma.$disconnect();
}

main().catch(console.error);
