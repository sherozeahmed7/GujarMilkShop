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
  const localSuppliers = await prisma.supplier.findMany({
    select: { id: true, name: true, cloudUuid: true }
  });
  console.log(`Local Suppliers count: ${localSuppliers.length}`);

  const supplierEvents = await prisma.syncQueue.findMany({
    where: { entityType: 'Supplier' },
    select: { cloudUuid: true, status: true, operation: true, error: true }
  });
  console.log(`Supplier events in SyncQueue: ${supplierEvents.length}`);
  supplierEvents.forEach(e => console.log(' ', e.status, e.operation, e.cloudUuid, e.error || ''));

  // Let's see how many suppliers have NO SyncQueue entry at all:
  const queuedUuids = new Set(supplierEvents.map(e => e.cloudUuid));
  const missingSync = localSuppliers.filter(s => !queuedUuids.has(s.cloudUuid));
  console.log(`Suppliers missing from SyncQueue entirely: ${missingSync.length}`);
  missingSync.slice(0, 5).forEach(s => console.log('  missing:', s.id, s.name, s.cloudUuid));

  await prisma.$disconnect();
}

main().catch(console.error);
