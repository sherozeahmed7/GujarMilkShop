import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const FK_MAP: Record<string, { entity: string; uuidKey: string }> = {
  saleId: { entity: 'Sale', uuidKey: 'sale_uuid' },
  productId: { entity: 'InventoryProduct', uuidKey: 'product_uuid' },
  supplierId: { entity: 'Supplier', uuidKey: 'supplier_uuid' },
  customerId: { entity: 'Customer', uuidKey: 'customer_uuid' },
  shiftId: { entity: 'Shift', uuidKey: 'shift_uuid' },
  userId: { entity: 'User', uuidKey: 'user_uuid' },
  openedById: { entity: 'User', uuidKey: 'opened_by_uuid' },
  closedById: { entity: 'User', uuidKey: 'closed_by_uuid' },
  cashPersonId: { entity: 'CashPerson', uuidKey: 'cash_person_uuid' },
};

async function run() {
  console.log('Fixing FKs in SyncQueue payloads...');
  
  // Grab all records that are not SYNCED
  const events = await prisma.syncQueue.findMany({
    where: { status: { in: ['FAILED', 'PENDING', 'SYNCING'] } }
  });

  let fixedCount = 0;

  for (const event of events) {
    let payload = JSON.parse(event.payload);
    let modified = false;

    for (const [localKey, config] of Object.entries(FK_MAP)) {
      if (payload[localKey] != null) {
        // Find the mapping
        const mapping = await prisma.localToCloudMapping.findFirst({
          where: { entityType: config.entity, localId: payload[localKey] }
        });

        if (mapping) {
          payload[config.uuidKey] = mapping.cloudUuid;
          modified = true;
        }
      }
    }

    if (modified) {
      await prisma.syncQueue.update({
        where: { eventUuid: event.eventUuid },
        data: { 
          payload: JSON.stringify(payload),
          status: 'PENDING', // Reset status so it tries again
          retryCount: 0,
          error: null
        }
      });
      fixedCount++;
    }
  }

  console.log(`Fixed ${fixedCount} queue records.`);
  await prisma.$disconnect();
}

run().catch(console.error);
