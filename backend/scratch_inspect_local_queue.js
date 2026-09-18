const path = require('path');
const os = require('os');
const { PrismaClient } = require('@prisma/client');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.join(appData, 'com.shero.tauri-app', 'pos.db');

console.log('Inspecting DB at:', dbPath);
process.env.DATABASE_URL = 'file:' + dbPath;

const prisma = new PrismaClient();

async function check() {
  try {
    const queue = await prisma.syncQueue.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    console.log('\n--- SyncQueue Records in pos.db ---');
    for (const q of queue) {
      console.log(`[${q.status}] ${q.entityType} #${q.localId} (${q.operation}) - error: ${q.error}`);
      console.log(`  eventUuid: ${q.eventUuid}`);
      console.log(`  payload: ${q.payload}`);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
