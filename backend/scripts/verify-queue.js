const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const groups = await prisma.syncQueue.groupBy({ by: ['status'], _count: { _all: true } });
  console.log('SyncQueue status breakdown:');
  groups.forEach(g => console.log(' ', g.status + ':', g._count._all));

  const byType = await prisma.syncQueue.groupBy({
    by: ['entityType'],
    _count: { _all: true },
    where: { status: 'PENDING' },
    orderBy: [{ entityType: 'asc' }]
  });
  console.log('\nPENDING by entity type:');
  byType.forEach(g => console.log(' ', g.entityType + ':', g._count._all));

  const mappingCount = await prisma.localToCloudMapping.count();
  console.log('\nTotal LocalToCloudMapping:', mappingCount);
  await prisma.$disconnect();
}
run();
