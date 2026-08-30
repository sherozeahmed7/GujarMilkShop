import { prisma } from './src/config/database';

async function verify() {
  const [syncCount, mappingCount, saleCount, customerCount, supplierCount, paymentCount] =
    await Promise.all([
      prisma.syncQueue.count(),
      prisma.localToCloudMapping.count(),
      prisma.sale.count(),
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.payment.count(),
    ]);

  console.log('=== Phase 5B SQLite Verification ===');
  console.log('SyncQueue rows:          ', syncCount);
  console.log('LocalToCloudMapping rows:', mappingCount);
  console.log('Sales:                   ', saleCount);
  console.log('Customers:               ', customerCount);
  console.log('Suppliers:               ', supplierCount);
  console.log('Payments:                ', paymentCount);
  console.log('====================================');
}

verify().then(() => prisma.$disconnect()).catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
