import { PrismaClient } from '@prisma/client';
import path from 'path';
import os from 'os';

const appDataBase = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.join(appDataBase, 'com.shero.tauri-app', 'pos.db');

const prisma = new PrismaClient({
  datasources: {
    db: { url: `file:${dbPath}` }
  }
});

async function inspectFailed() {
  const item = await prisma.syncQueue.findFirst({
    where: { entityType: 'InventoryMovement' }
  });
  console.log('SyncQueue Item:', JSON.stringify(item, null, 2));

  if (item) {
    const payload = JSON.parse(item.payload);
    console.log('Payload:', payload);

    const productMapping = await prisma.localToCloudMapping.findFirst({
      where: { entityType: 'InventoryProduct' }
    });
    console.log('Product mappings:', productMapping);

    const allMappings = await prisma.localToCloudMapping.findMany();
    console.log('All local mappings:', allMappings);
  }
}

inspectFailed().finally(() => prisma.$disconnect());
