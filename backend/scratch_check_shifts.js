const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const shiftCount = await prisma.shift.count();
  const saleCount = await prisma.sale.count();
  const paymentCount = await prisma.payment.count();
  const latestSales = await prisma.sale.findMany({
    orderBy: { id: 'desc' },
    take: 3,
    include: { payments: true }
  });
  console.log('Counts:', { shiftCount, saleCount, paymentCount });
  console.log('Latest sales:', JSON.stringify(latestSales, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
