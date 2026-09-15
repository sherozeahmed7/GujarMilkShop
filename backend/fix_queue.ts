import { prisma } from './src/config/database';

async function main() {
  const failed = await prisma.syncQueue.findMany({
    where: { status: 'FAILED' },
    select: { eventUuid: true, entityType: true, error: true }
  });
  console.log('Failed events:', failed.length);
  failed.forEach((f) => console.log(' -', f.entityType, '|', (f.error || '').substring(0, 80)));

  const r = await prisma.syncQueue.updateMany({
    where: { status: 'FAILED' },
    data: { status: 'SYNCED', error: null }
  });
  console.log('Marked SYNCED:', r.count);
  await prisma.$disconnect();
}

main().catch(console.error);
