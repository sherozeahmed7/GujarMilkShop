import { PrismaClient } from '@prisma/client';
import path from 'path';
import os from 'os';

const appDataBase = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.join(appDataBase, 'com.shero.tauri-app', 'pos.db');

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } }
});

async function resetFailedEvents() {
  const res = await prisma.syncQueue.updateMany({
    where: { status: 'PENDING' },
    data: {
      retryCount: 0,
      nextRetryAt: null,
      error: null
    }
  });
  console.log('Reset items for immediate sync:', res.count);
}

resetFailedEvents().finally(() => prisma.$disconnect());
