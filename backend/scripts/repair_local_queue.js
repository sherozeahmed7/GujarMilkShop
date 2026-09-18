const path = require('path');
const os = require('os');
const { PrismaClient } = require('@prisma/client');

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.join(appData, 'com.shero.tauri-app', 'pos.db');
process.env.DATABASE_URL = 'file:' + dbPath;

const prisma = new PrismaClient();

async function repair() {
  console.log('Repairing pos.db syncQueue at:', dbPath);

  // 1. Fix Return #1 payload (ensure customer field is present)
  const returnEvent = await prisma.syncQueue.findFirst({
    where: { entityType: 'Return', localId: 1 },
  });

  if (returnEvent) {
    const returnRecord = await prisma.return.findUnique({ where: { id: 1 } });
    const payload = JSON.parse(returnEvent.payload);
    payload.customer = returnRecord?.customer || 'Walk-in';
    
    await prisma.syncQueue.update({
      where: { eventUuid: returnEvent.eventUuid },
      data: {
        payload: JSON.stringify(payload),
        status: 'PENDING',
        error: null,
        retryCount: 0,
      },
    });
    console.log('✅ Repaired Return #1 event in syncQueue.');
  }

  // 2. Reset ReturnItem #1 to PENDING
  const returnItemEvent = await prisma.syncQueue.findFirst({
    where: { entityType: 'ReturnItem', localId: 1 },
  });
  if (returnItemEvent) {
    await prisma.syncQueue.update({
      where: { eventUuid: returnItemEvent.eventUuid },
      data: {
        status: 'PENDING',
        error: null,
        retryCount: 0,
      },
    });
    console.log('✅ Reset ReturnItem #1 event to PENDING.');
  }

  // 3. Reset User #1 to PENDING
  const userEvent = await prisma.syncQueue.findFirst({
    where: { entityType: 'User', localId: 1 },
  });
  if (userEvent) {
    await prisma.syncQueue.update({
      where: { eventUuid: userEvent.eventUuid },
      data: {
        status: 'PENDING',
        error: null,
        retryCount: 0,
      },
    });
    console.log('✅ Reset User #1 event to PENDING.');
  }

  await prisma.$disconnect();
}

repair().catch(err => {
  console.error('Error during repair:', err);
  process.exit(1);
});
