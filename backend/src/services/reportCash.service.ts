import { prisma } from '../config/database';

/** Balance from cash receipts and payments within the selected period range. */
export async function currentDrawerCash(startDate?: Date, endDate?: Date) {
  const asOf = endDate || new Date();
  const createdAt: { gte?: Date; lte: Date } = { lte: asOf };
  if (startDate) {
    createdAt.gte = startDate;
  }
  const [payments, expenses, suppliers, refunds, cashbook] = await Promise.all([
    prisma.payment.aggregate({
      where: { method: 'cash', status: { in: ['completed', 'partial'] }, createdAt, sale: { status: { not: 'voided' } } },
      _sum: { amount: true },
    }),
    prisma.expensePayment.aggregate({ where: { createdAt }, _sum: { amount: true } }),
    prisma.supplierPayment.aggregate({ where: { createdAt }, _sum: { amount: true } }),
    prisma.return.aggregate({
      where: { paymentMethod: { in: ['Cash', 'cash'] }, status: 'Completed', createdAt },
      _sum: { refundAmount: true },
    }),
    prisma.cashbookTransaction.findMany({
      where: { transactionType: { in: ['Receive Amount', 'Pay Amount'] }, createdAt },
      select: { transactionType: true, amount: true },
    }),
  ]);
  const money = (value: number) => Math.round(value * 100) / 100;
  const breakdown = {
    salesCash: money(payments._sum.amount || 0),
    expensePayments: money(expenses._sum.amount || 0),
    supplierPayments: money(suppliers._sum.amount || 0),
    refunds: money(refunds._sum.refundAmount || 0),
    otherReceived: money(cashbook.filter(t => t.transactionType === 'Receive Amount').reduce((sum, t) => sum + t.amount, 0)),
    otherPaid: money(cashbook.filter(t => t.transactionType === 'Pay Amount').reduce((sum, t) => sum + t.amount, 0)),
  };
  return {
    amount: money(breakdown.salesCash + breakdown.otherReceived - breakdown.expensePayments - breakdown.supplierPayments - breakdown.refunds - breakdown.otherPaid),
    asOf: asOf.toISOString(),
    basis: startDate
      ? 'Cash receipts minus cash expenses, supplier payments, refunds, and payouts for selected period'
      : 'All existing and previous cash receipts minus recorded cash payments',
    breakdown,
  };
}

