import { processSyncQueue } from './src/workers/syncWorker';
import { prisma } from './src/config/database';
import path from 'path';
import os from 'os';

async function testSyncNow() {
  console.log('Running processSyncQueue()...');
  await processSyncQueue();

  const items = await prisma.syncQueue.findMany({
    where: { status: { not: 'SYNCED' } }
  });
  console.log('Remaining non-synced items:', items);
}

testSyncNow().finally(() => {
  prisma.$disconnect();
  process.exit(0);
});
