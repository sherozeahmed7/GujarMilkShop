import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const total = await prisma.syncQueue.count();
  const pending = await prisma.syncQueue.count({ where: { status: 'PENDING' }});
  const synced = await prisma.syncQueue.count({ where: { status: 'SYNCED' }});
  const failed = await prisma.syncQueue.count({ where: { status: 'FAILED' }});
  const syncing = await prisma.syncQueue.count({ where: { status: 'SYNCING' }});

  console.log('=== LOCAL SYNCQUEUE STATS ===');
  console.log('Total:', total);
  console.log('PENDING:', pending);
  console.log('SYNCED:', synced);
  console.log('FAILED:', failed);
  console.log('SYNCING (stuck):', syncing);

  const failures = await prisma.syncQueue.findMany({ 
    where: { status: 'FAILED' }, 
    take: 10, 
    select: { entityType: true, error: true, retryCount: true, cloudUuid: true }
  });
  console.log('\n=== FAILED Events Sample ===');
  failures.forEach(f => console.log(JSON.stringify(f)));

  const oldestPending = await prisma.syncQueue.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
    take: 5,
    select: { entityType: true, cloudUuid: true, createdAt: true, nextRetryAt: true, retryCount: true, layer: true }
  });
  console.log('\n=== Oldest PENDING Events ===');
  oldestPending.forEach(e => console.log(JSON.stringify(e)));

  const settings = await prisma.cloudSyncSettings.findUnique({ where: { id: 1 }});
  console.log('\n=== CloudSyncSettings ===');
  console.log(JSON.stringify(settings));

  // Local record counts
  const customers = await prisma.customer.count();
  const sales = await prisma.sale.count();
  const users = await prisma.user.count();
  console.log('\n=== LOCAL SQLITE RECORD COUNTS ===');
  console.log('Customer:', customers);
  console.log('Sale:', sales);
  console.log('User:', users);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });
