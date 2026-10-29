const path = require('path');
const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = 'file:C:/Users/shero/AppData/Roaming/com.shero.tauri-app/pos.db?connection_limit=1';
const prisma = new PrismaClient();

async function runPass() {
  try {
    const { processSyncQueue } = require(path.join(__dirname, '../dist/workers/syncWorker'));
    console.log('--- Calling processSyncQueue() from dist/workers/syncWorker ---');
    const start = Date.now();
    await processSyncQueue();
    console.log(`--- Finished in ${Date.now() - start}ms ---`);

    const stats = await prisma.syncQueue.groupBy({ by: ['status'], _count: { eventUuid: true } });
    console.log('SyncQueue status distribution:', stats);

    const lastSettings = await prisma.cloudSyncSettings.findUnique({ where: { id: 1 } });
    console.log('lastSuccessfulUpstreamSyncAt:', lastSettings.lastSuccessfulUpstreamSyncAt);
  } catch (err) {
    console.error('Error during pass:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runPass();
