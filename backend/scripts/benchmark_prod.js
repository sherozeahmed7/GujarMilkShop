const path = require('path');
const { PrismaClient } = require('@prisma/client');

const dbPath = path.join(process.cwd(), 'scratch_test_pos.db');
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath.replace(/\\/g, '/')}` } }
});

async function runBenchmarks() {
  console.log('=== FINANCIAL & PERFORMANCE BENCHMARKS (28.7MB PRODUCTION DB) ===');

  // 1. Data Counts
  const [salesCount, customersCount, itemsCount, paymentsCount, expensesCount] = await Promise.all([
    prisma.sale.count(),
    prisma.customer.count(),
    prisma.saleItem.count(),
    prisma.payment.count(),
    prisma.expense.count(),
  ]);

  console.log(`Entities: ${salesCount} sales, ${customersCount} customers, ${itemsCount} items, ${paymentsCount} payments, ${expensesCount} expenses.`);

  // 2. Measure Khata Customer Balance Aggregation (Before vs After Index)
  const khataTimes = [];
  for (let i = 0; i < 10; i++) {
    const t0 = process.hrtime.bigint();
    const dues = await prisma.sale.findMany({
      where: {
        remainingBalance: { gt: 0 },
        customerId: { not: null }
      },
      select: { customerId: true, remainingBalance: true }
    });
    const t1 = process.hrtime.bigint();
    khataTimes.push(Number(t1 - t0) / 1e6); // ms
  }
  khataTimes.sort((a, b) => a - b);
  const khataP50 = khataTimes[Math.floor(khataTimes.length * 0.5)];
  const khataP95 = khataTimes[Math.floor(khataTimes.length * 0.95)];
  const khataMax = khataTimes[khataTimes.length - 1];
  console.log(`Khata Dues Query (10 runs): p50=${khataP50.toFixed(2)}ms, p95=${khataP95.toFixed(2)}ms, max=${khataMax.toFixed(2)}ms`);

  // 3. Measure Shifts Report Bulk Query
  const shiftTimes = [];
  const minDate = new Date('2026-10-01T00:00:00.000Z');
  const maxDate = new Date('2026-10-11T23:59:59.999Z');
  for (let i = 0; i < 10; i++) {
    const t0 = process.hrtime.bigint();
    const periodSales = await prisma.sale.findMany({
      where: { createdAt: { gte: minDate, lte: maxDate } },
      select: { id: true, totalAmount: true, createdAt: true, saleType: true }
    });
    const t1 = process.hrtime.bigint();
    shiftTimes.push(Number(t1 - t0) / 1e6);
  }
  shiftTimes.sort((a, b) => a - b);
  const shiftP50 = shiftTimes[Math.floor(shiftTimes.length * 0.5)];
  const shiftP95 = shiftTimes[Math.floor(shiftTimes.length * 0.95)];
  const shiftMax = shiftTimes[shiftTimes.length - 1];
  console.log(`Shift Bulk Query (10 runs): p50=${shiftP50.toFixed(2)}ms, p95=${shiftP95.toFixed(2)}ms, max=${shiftMax.toFixed(2)}ms`);

  // 4. Financial Integrity Validation
  const totalSalesSum = await prisma.sale.aggregate({
    _sum: { totalAmount: true, paidAmount: true, remainingBalance: true }
  });
  console.log('=== FINANCIAL RECONCILIATION TOTALS ===');
  console.log('Gross Sales Total:', totalSalesSum._sum.totalAmount);
  console.log('Paid Amount Total:', totalSalesSum._sum.paidAmount);
  console.log('Remaining Balance Total:', totalSalesSum._sum.remainingBalance);

  await prisma.$disconnect();
}

runBenchmarks().catch(console.error);
