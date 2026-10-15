import path from 'path';
import os from 'os';
import fs from 'fs';

const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.join(appData, 'com.shero.tauri-app', 'pos.db');
if (!fs.existsSync(dbPath)) throw new Error(`Production SQLite not found: ${dbPath}`);
process.env.DATABASE_URL = `file:${dbPath}`;

async function main() {
  const { prisma } = await import('../src/config/database');
  const { SyncQueueService } = await import('../src/services/syncQueue.service');
  const {
    WALK_IN_CUSTOMER_CLOUD_UUID,
    WALK_IN_CUSTOMER_NAME,
    WALK_IN_CUSTOMER_TYPE,
  } = await import('../src/config/walkInCustomer');

  const backupPath = path.join(
    path.dirname(dbPath),
    `pos-pre-walk-in-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
  );
  await prisma.$executeRawUnsafe(`VACUUM INTO '${backupPath.replace(/'/g, "''")}'`);

  const result = await prisma.$transaction(async (tx) => {
    const candidates = await tx.customer.findMany({
      where: { customerType: WALK_IN_CUSTOMER_TYPE }, orderBy: { id: 'asc' },
    });
    const canonical = candidates[0] || await tx.customer.create({
      data: { name: WALK_IN_CUSTOMER_NAME, customerType: WALK_IN_CUSTOMER_TYPE, status: 'active' },
    });
    const duplicateIds = candidates.slice(1).map((row) => row.id);
    const mapping = await tx.localToCloudMapping.findUnique({
      where: {
        deviceId_entityType_localId: {
          deviceId: SyncQueueService.getDeviceId(), entityType: 'Customer', localId: canonical.id,
        },
      },
    });
    await SyncQueueService.createCloudMapping(
      'Customer', canonical.id, WALK_IN_CUSTOMER_CLOUD_UUID, tx
    );
    if (!mapping) {
      await SyncQueueService.enqueueUpdate(tx, 'Customer', canonical.id, canonical, 0, 'UPSERT');
    }

    const sales = await tx.sale.findMany({
      where: {
        saleType: 'walk_in',
        OR: [
          { customerId: null },
          ...(duplicateIds.length ? [{ customerId: { in: duplicateIds } }] : []),
        ],
      },
    });
    for (const sale of sales) {
      const updated = await tx.sale.update({ where: { id: sale.id }, data: { customerId: canonical.id } });
      const currentSaleMapping = await SyncQueueService.getCloudMapping('Sale', updated.id, tx);
      if (!currentSaleMapping) {
        const priorSaleMapping = await tx.localToCloudMapping.findFirst({
          where: { entityType: 'Sale', localId: updated.id },
          orderBy: { createdAt: 'asc' },
        });
        if (priorSaleMapping) {
          await SyncQueueService.createCloudMapping('Sale', updated.id, priorSaleMapping.cloudUuid, tx);
        }
      }
      await SyncQueueService.enqueueUpdate(tx, 'Sale', updated.id, updated, 1);
    }
    if (duplicateIds.length) {
      await tx.localToCloudMapping.deleteMany({ where: { entityType: 'Customer', localId: { in: duplicateIds } } });
      await tx.customer.deleteMany({ where: { id: { in: duplicateIds } } });
    }
    return { canonicalId: canonical.id, salesRepointed: sales.length, duplicatesRemoved: duplicateIds.length };
  }, { timeout: 300_000 });

  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Customer_single_walk_in_key" ON "Customer"("customerType") WHERE "customerType"='walk_in'`
  );
  const verification = {
    walkInCustomers: await prisma.customer.count({ where: { customerType: 'walk_in' } }),
    walkInSales: await prisma.sale.count({ where: { saleType: 'walk_in' } }),
    linkedWalkInSales: await prisma.sale.count({
      where: { saleType: 'walk_in', customerId: result.canonicalId },
    }),
  };
  console.log(JSON.stringify({ dbPath, backupPath, result, verification }, null, 2));
  await prisma.$disconnect();
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
