import { prisma } from '../src/config/database';

async function main() {
  console.log('Fetching shifts...');
  const shifts = await prisma.shift.findMany({ orderBy: { openedAt: 'asc' } });
  console.log(`Found ${shifts.length} shifts.`);

  for (const shift of shifts) {
    const start = new Date(shift.openedAt);
    const end = shift.closedAt ? new Date(shift.closedAt) : new Date(start.getTime() + 24 * 3600 * 1000);
    const result = await prisma.sale.updateMany({
      where: {
        createdAt: { gte: start, lte: end },
        createdById: null,
      },
      data: {
        createdById: shift.openedById,
      },
    });
    if (result.count > 0) {
      console.log(`Shift #${shift.id} (openedById=${shift.openedById}): assigned ${result.count} sales.`);
    }
  }

  const remaining = await prisma.sale.updateMany({
    where: { createdById: null },
    data: { createdById: 1 },
  });
  console.log(`Remaining sales without shifts assigned to Admin (user 1): ${remaining.count}`);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
