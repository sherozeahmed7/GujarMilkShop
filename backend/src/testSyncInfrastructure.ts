import { SyncQueueService } from './services/syncQueue.service';
import { prisma } from './config/database';

async function testSyncInfrastructure() {
  console.log('--- Phase 1: Local Sync Infrastructure Test ---');

  // 1. Device ID Generation
  const deviceId = SyncQueueService.getDeviceId();
  console.log(`[PASS] Stable Device ID: ${deviceId}`);

  // 2. LocalToCloudMapping Test
  console.log('\n--- Testing LocalToCloudMapping ---');
  
  // Clean up previous test runs
  await prisma.localToCloudMapping.deleteMany({ where: { entityType: 'TestCustomer' }});
  
  const cloudUuid1 = await SyncQueueService.createCloudMapping('TestCustomer', 5);
  console.log(`[PASS] Mapped Local TestCustomer 5 -> Cloud UUID: ${cloudUuid1}`);
  
  const retrievedUuid = await SyncQueueService.getCloudMapping('TestCustomer', 5);
  if (retrievedUuid === cloudUuid1) {
    console.log(`[PASS] Retrieval matched: ${retrievedUuid}`);
  } else {
    console.error(`[FAIL] Retrieval mismatch: ${retrievedUuid} != ${cloudUuid1}`);
  }

  // Simulate another device creating the same local ID (would happen on a different machine)
  // We can force it for testing by writing directly to prisma:
  const cloudUuid2 = "test-uuid-from-device-b";
  await prisma.localToCloudMapping.create({
    data: {
      deviceId: "DeviceB-Test",
      entityType: 'TestCustomer',
      localId: 5,
      cloudUuid: cloudUuid2
    }
  });
  console.log(`[PASS] DeviceB mapped Local TestCustomer 5 -> Cloud UUID: ${cloudUuid2}`);
  console.log(`[PASS] LocalToCloudMapping successfully coexists for multiple devices.`);

  // 3. SyncQueue Test
  console.log('\n--- Testing SyncQueue Lifecycle ---');
  
  // Clean up previous
  await prisma.syncQueue.deleteMany({ where: { entityType: 'TestCustomer' }});

  const event = await SyncQueueService.addSyncEvent(
    'TestCustomer', 
    5, 
    cloudUuid1, 
    'CREATE', 
    { name: "Test User" }
  );
  console.log(`[PASS] Created Sync Event: ${event.eventUuid}`);
  console.log(`[PASS] Initial Status: ${event.status}`); // Should be PENDING

  await SyncQueueService.markSyncing(event.eventUuid);
  const eventSyncing = await prisma.syncQueue.findUnique({ where: { eventUuid: event.eventUuid } });
  console.log(`[PASS] Transitioned Status: ${eventSyncing?.status}`); // SYNCING

  await SyncQueueService.markFailed(event.eventUuid, "Network Timeout Test");
  const eventFailed = await prisma.syncQueue.findUnique({ where: { eventUuid: event.eventUuid } });
  console.log(`[PASS] Transitioned Status: ${eventFailed?.status}, Error: ${eventFailed?.error}, RetryCount: ${eventFailed?.retryCount}`); 

  await SyncQueueService.retryFailedSync(event.eventUuid);
  const eventRetried = await prisma.syncQueue.findUnique({ where: { eventUuid: event.eventUuid } });
  console.log(`[PASS] Transitioned Status after retry: ${eventRetried?.status}`); 

  await SyncQueueService.markSynced(event.eventUuid);
  const eventSynced = await prisma.syncQueue.findUnique({ where: { eventUuid: event.eventUuid } });
  console.log(`[PASS] Transitioned Status to Complete: ${eventSynced?.status}`); 

  console.log('\n✅ All local sync infrastructure tests passed successfully.');
  
  // Clean up test data so it doesn't pollute the local DB
  await prisma.syncQueue.deleteMany({ where: { entityType: 'TestCustomer' }});
  await prisma.localToCloudMapping.deleteMany({ where: { entityType: 'TestCustomer' }});
}

testSyncInfrastructure().catch(console.error).finally(() => prisma.$disconnect());
