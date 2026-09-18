/**
 * Test script to verify real SQLite data flow for /reports/f2-sales
 */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function testF2SalesReport() {
  console.log('=== TESTING REAL F2 SALES IN SQLITE ===');

  const f2Names = ['lassi', 'butter', 'ghee'];
  const allSales = await prisma.sale.findMany({
    include: { items: true, payments: true, customer: true },
    orderBy: { createdAt: 'desc' }
  });

  const f2Sales = allSales.filter(s =>
    s.items.some(i => f2Names.includes((i.itemName || '').trim().toLowerCase()))
  );

  console.log(`Total Sales in SQLite: ${allSales.length}`);
  console.log(`Sales containing F2 items (Lassi, Butter, Ghee): ${f2Sales.length}`);

  for (const s of f2Sales) {
    const f2Items = s.items.filter(i => f2Names.includes((i.itemName || '').trim().toLowerCase()));
    console.log(`\nSale #${s.id} (${s.saleType}) — Date: ${s.createdAt.toISOString()}`);
    console.log(`  Customer: ${s.customerName || s.customer?.name || 'Walk-in'}`);
    console.log(`  Total: Rs. ${s.totalAmount}, Paid: Rs. ${s.paidAmount}`);
    console.log(`  F2 Items:`, f2Items.map(i => `${i.itemName}: ${i.quantity} kg @ Rs. ${i.unitPrice} = Rs. ${i.totalPrice}`));
  }
}

testF2SalesReport().finally(() => prisma.$disconnect());
