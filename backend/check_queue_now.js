const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Fix BigInt serialization
const stringify = (obj) => JSON.stringify(obj, (key, val) => typeof val === 'bigint' ? val.toString() : val, 2);

async function main() {
  const downState = await p.downstreamSyncState.findFirst();
  console.log('=== DOWNSTREAM SYNC STATE ===');
  console.log(stringify(downState));

  const cloudSettings = await p.cloudSyncSettings.findFirst();
  console.log('\n=== CLOUD SYNC SETTINGS ===');
  console.log(stringify(cloudSettings));

  const milkMappings = await p.localToCloudMapping.findMany({
    where: { entityType: 'InventoryProduct' }
  });
  console.log('\n=== InventoryProduct Mappings ===');
  console.log(stringify(milkMappings));

  const syncingEvents = await p.syncQueue.findMany({
    where: { status: 'SYNCING' },
    select: { eventUuid: true, entityType: true, operation: true, cloudUuid: true, localId: true, retryCount: true, updatedAt: true }
  });
  console.log('\n=== SYNCING EVENTS (stuck) ===');
  console.log(stringify(syncingEvents));

  await p.$disconnect();
}

main().catch(e => { console.error(e.message); p.$disconnect(); });
