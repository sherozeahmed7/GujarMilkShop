import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function clean() {
  await prisma.sale.deleteMany({
    where: { totalAmount: 500, saleType: 'walk_in' }
  });
  
  const customers = await prisma.customer.findMany({
    where: { name: { contains: 'Test' } }
  });
  for (const c of customers) {
    await prisma.customer.delete({ where: { id: c.id } });
  }
  console.log('Cleaned SQLite');
}
clean().then(() => prisma.$disconnect());
