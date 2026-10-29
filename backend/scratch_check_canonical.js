const path = require('path');
const os = require('os');
const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.join(appData, 'com.shero.tauri-app', 'pos.db');
process.env.DATABASE_URL = `file:${dbPath}?connection_limit=1&socket_timeout=3`;

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const shift15 = await prisma.shift.findUnique({
    where: { id: 15 },
    include: { openedBy: true }
  });
  console.log('Shift 15:', shift15);

  const payments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: shift15.openedAt }
    }
  });
  console.log('Payments since shift opened:', payments);

  const sales = await prisma.sale.findMany({
    where: {
      createdAt: { gte: shift15.openedAt }
    },
    include: { payments: true }
  });
  console.log('Sales count since shift opened:', sales.length);
  const totalSaleAmount = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  console.log('Total sales amount:', totalSaleAmount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
