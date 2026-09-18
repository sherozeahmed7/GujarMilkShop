const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

async function check() {
  const items = await prisma.saleItem.findMany({
    select: { id: true, itemName: true, quantity: true, unitPrice: true, totalPrice: true, saleId: true }
  });
  console.log('=== DISTINCT SALE ITEM NAMES ===');
  const distinctNames = [...new Set(items.map(i => i.itemName))];
  console.log(distinctNames);
  console.log('=== ALL SALE ITEMS (' + items.length + ') ===');
  console.log(JSON.stringify(items, null, 2));

  const sales = await prisma.sale.findMany({
    include: { items: true, payments: true, customer: true }
  });
  console.log('=== TOTAL SALES COUNT: ' + sales.length + ' ===');
}

check().finally(() => prisma.$disconnect());
