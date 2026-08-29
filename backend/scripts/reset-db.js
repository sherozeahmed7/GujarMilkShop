/**
 * Wipe all business data and re-seed only the super admin.
 * Usage: node scripts/reset-db.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const ALL_SCREENS = [
  'Dashboard', 'Point of Sale', 'Inventory', 'Suppliers', 'Customers',
  'Khata / Ledger', 'Returns', 'Receipt Audit', 'Shifts', 'Cash Register', 'Expenses',
  'Sales Report', 'F2 Sales Report', 'Supplier Report', 'Customer Report',
  'Inventory Report', 'Returns Report', 'Cash Register Report', 'Shifts Report',
  'Expenses Report', 'Backup Report', 'Profit & Loss', 'Activity Logs',
  'Daily Rates', 'Shop Info', 'POS Config', 'Users & Roles', 'Cloud & Sync', 'Local Backup',
];

async function reset() {
  console.log('🧹 Clearing all tables...');

  // Children / dependent rows first
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.returnItem.deleteMany();
  await prisma.milkProductTransaction.deleteMany();
  await prisma.butterGheeConversion.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.supplierCollection.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.return.deleteMany();
  await prisma.heldCart.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.auditRecord.deleteMany();
  await prisma.activityLog.deleteMany();
  await prisma.milkProductDailyStock.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.inventoryProduct.deleteMany();
  await prisma.dailyRate.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ All rows deleted.');

  const password = await bcrypt.hash('admin123', 10);
  await prisma.user.create({
    data: {
      name: 'Shehroz',
      email: 'admin@gujarmilkshop.com',
      password,
      role: 'super_admin',
      status: 'active',
      assignedScreens: JSON.stringify(ALL_SCREENS),
    },
  });

  console.log('👤 Super admin re-seeded: admin@gujarmilkshop.com / admin123');
  console.log('✨ Database is clean. Start fresh testing.');
}

reset()
  .catch((e) => {
    console.error('❌ Reset failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
