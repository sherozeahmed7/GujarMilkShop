const { PrismaClient } = require('@prisma/client');
process.env.DATABASE_URL = 'file:C:/Users/shero/AppData/Roaming/com.shero.tauri-app/pos.db?connection_limit=1';
const prisma = new PrismaClient();

async function findSlowBatch() {
  try {
    const ready = await prisma.syncQueue.findMany({
      where: {
        status: 'PENDING',
        operation: { not: 'DELETE' },
        OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: new Date() } }]
      },
      orderBy: [{ layer: 'asc' }, { createdAt: 'asc' }],
      take: 50
    });

    console.log('Batch count:', ready.length);
    const byType = {};
    for (const r of ready) byType[r.entityType] = (byType[r.entityType] || 0) + 1;
    console.log('Entities in this batch:', byType);

    // Test timing for items 1-by-1 to see WHICH item is blocking
    for (let i = 0; i < Math.min(ready.length, 10); i++) {
      const e = ready[i];
      const tStart = Date.now();
      const res = await fetch('http://localhost:5000/api/sync/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sync-secret': 'gujar_milk_shop_sync_secret_2026'
        },
        body: JSON.stringify({
          batchId: 'perf-single-' + i,
          payloads: [{
            eventUuid: e.eventUuid,
            cloudUuid: e.cloudUuid,
            entityType: e.entityType,
            deviceId: e.deviceId,
            localId: e.localId,
            operation: e.operation,
            payload: e.payload
          }]
        })
      });
      const tElapsed = Date.now() - tStart;
      const json = await res.json();
      const itemRes = json.results?.[0];
      console.log(`[Item #${i}] ${e.entityType} ${e.cloudUuid.slice(0, 8)} -> ${tElapsed}ms | ${itemRes?.status} ${itemRes?.error || ''}`);
    }
  } catch (err) {
    console.error('Test error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

findSlowBatch();
