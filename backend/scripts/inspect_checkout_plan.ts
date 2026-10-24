import { prisma, connectDB } from '../src/config/database';

async function main() {
  await connectDB();

  console.log('--- EXPLAIN QUERY PLANS ---');
  const p1 = await (prisma as any).$queryRawUnsafe("EXPLAIN QUERY PLAN SELECT tokenNumber FROM Sale WHERE createdAt >= '2026-10-01' ORDER BY tokenNumber DESC LIMIT 1");
  console.log('token plan:', p1);

  const p2 = await (prisma as any).$queryRawUnsafe("EXPLAIN QUERY PLAN SELECT quantity FROM InventoryMovement WHERE productId = 1");
  console.log('inventory movement plan:', p2);

  const p3 = await (prisma as any).$queryRawUnsafe("EXPLAIN QUERY PLAN SELECT id FROM Customer WHERE customerType = 'walk_in' ORDER BY id ASC LIMIT 1");
  console.log('walk in customer plan:', p3);

  const p4 = await (prisma as any).$queryRawUnsafe("EXPLAIN QUERY PLAN SELECT eventUuid FROM SyncQueue WHERE status = 'PENDING' ORDER BY layer ASC, createdAt ASC LIMIT 50");
  console.log('sync queue plan:', p4);

  const busyTimeout = await (prisma as any).$queryRawUnsafe("PRAGMA busy_timeout");
  console.log('busy_timeout:', busyTimeout);
  const journalMode = await (prisma as any).$queryRawUnsafe("PRAGMA journal_mode");
  console.log('journal_mode:', journalMode);
  const synchronous = await (prisma as any).$queryRawUnsafe("PRAGMA synchronous");
  console.log('synchronous:', synchronous);
  const walCheck = await (prisma as any).$queryRawUnsafe("PRAGMA wal_autocheckpoint");
  console.log('wal_autocheckpoint:', walCheck);

  await prisma.$disconnect();
}
main().catch(console.error);
