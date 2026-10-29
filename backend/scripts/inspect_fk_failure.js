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
  const fkError = await prisma.syncQueue.findFirst({
    where: {
      status: 'FAILED',
      error: { contains: 'foreign key constraint' }
    }
  });

  console.log('=== FK ERROR RECORD ===');
  console.log(JSON.stringify(fkError, null, 2));

  if (fkError) {
    const payload = JSON.parse(fkError.payload);
    console.log('Supplier UUID in payload:', payload.supplier_uuid || payload.supplierUuid);
    console.log('Supplier ID / Local ID:', fkError.localId);

    // Look up supplier in SQLite
    const supplier = await prisma.supplier.findFirst({
      where: {
        OR: [
          { cloudUuid: payload.supplier_uuid || payload.supplierUuid },
          { id: fkError.localId }
        ]
      }
    });
    console.log('Local Supplier in SQLite:', supplier);

    // Check if that supplier has a sync event in SyncQueue
    if (supplier) {
      const suppSync = await prisma.syncQueue.findFirst({
        where: {
          entityType: 'Supplier',
          cloudUuid: supplier.cloudUuid
        }
      });
      console.log('Supplier SyncQueue entry:', suppSync);
    }
  }

  await prisma.$disconnect();
}

main().catch(console.error);
