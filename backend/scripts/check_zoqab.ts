import { prisma } from '../src/config/database';
import fs from 'fs';

async function main() {
  const cust = await prisma.customer.findFirst({
    where: { name: { contains: 'Zoqab' } },
  });

  if (!cust) {
    fs.writeFileSync('scratch_zoqab.json', JSON.stringify({ error: 'Customer not found' }));
    return;
  }

  const sales = await prisma.sale.findMany({
    where: { customerId: cust.id },
    include: { payments: true }
  });

  const payments = await prisma.payment.findMany({
    where: { sale: { customerId: cust.id } },
    select: { id: true, amount: true, status: true, createdAt: true, saleId: true }
  });

  fs.writeFileSync('scratch_zoqab.json', JSON.stringify({
    cust,
    salesCount: sales.length,
    sales: sales.map(s => ({
      id: s.id,
      saleType: s.saleType,
      totalAmount: s.totalAmount,
      paidAmount: s.paidAmount,
      remainingBalance: s.remainingBalance,
      createdAt: s.createdAt,
      paymentsCount: s.payments.length,
      payments: s.payments.map(p => ({ id: p.id, amount: p.amount, status: p.status, createdAt: p.createdAt }))
    })),
    allPayments: payments
  }, null, 2));
}

main().catch(e => {
  fs.writeFileSync('scratch_zoqab.json', JSON.stringify({ error: String(e) }));
}).finally(() => process.exit(0));
