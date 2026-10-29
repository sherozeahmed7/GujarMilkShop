const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = 'file:C:/Users/shero/AppData/Roaming/com.shero.tauri-app/pos.db?connection_limit=1';
const prisma = new PrismaClient();

async function testSingle() {
  try {
    const syncingEvents = await prisma.syncQueue.findMany({ where: { status: 'SYNCING' }, take: 1 });
    const event = syncingEvents[0];
    console.log('Testing event:', event.entityType, event.eventUuid, event.cloudUuid);

    const start = Date.now();
    const res = await fetch('http://localhost:5000/api/sync/batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': 'gujar_milk_shop_sync_secret_2026'
      },
      body: JSON.stringify({
        batchId: 'test-batch-single-1',
        payloads: [{
          eventUuid: event.eventUuid,
          cloudUuid: event.cloudUuid,
          entityType: event.entityType,
          deviceId: event.deviceId,
          localId: event.localId,
          operation: event.operation,
          payload: event.payload
        }]
      })
    });

    const elapsed = Date.now() - start;
    const json = await res.json();
    console.log(`Elapsed: ${elapsed}ms | HTTP Status: ${res.status}`);
    console.log('Response JSON:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSingle();
