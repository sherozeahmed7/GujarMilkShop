/**
 * Wipe all local SQLite business data except super_admin users,
 * then re-seed core inventory products + default daily rates.
 *
 * Usage (from backend/): npx ts-node wipeKeepSuperAdmin.ts
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const SUPER_ADMIN_ROLE = process.env.SUPER_ADMIN_ROLE || 'super_admin';
const ALL_SCREENS = [
  'Dashboard',
  'POS',
  'Suppliers',
  'Customers',
  'Inventory',
  'Expenses',
  'Returns',
  'Khata',
  'Reports',
  'Shifts',
  'Audit',
  'Register',
  'Cashbook',
  'Daily Rates',
  'Users',
  'Settings',
  'Cloud Sync',
  'POS Config',
];

async function wipe() {
  console.log('Wiping SQLite data (keeping super_admin users)...');

  // Children / leaf tables first
  await prisma.expensePayment.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.returnItem.deleteMany();
  await prisma.return.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.inventoryMovement.deleteMany();
  await prisma.supplierCollection.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.heldCart.deleteMany();
  await prisma.milkProductTransaction.deleteMany();
  await prisma.butterGheeConversion.deleteMany();
  await prisma.milkProductDailyStock.deleteMany();
  await prisma.auditRecord.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.dailyRate.deleteMany();
  await prisma.inventoryProduct.deleteMany();

  // Sync / config (reset local sync state too)
  await prisma.syncQueue.deleteMany();
  await prisma.localToCloudMapping.deleteMany();
  await prisma.downstreamAppliedEvent.deleteMany();
  await prisma.downstreamSyncState.deleteMany();
  await prisma.cloudSyncSettings.deleteMany();
  await prisma.pOSConfig.deleteMany();

  // Ensure we do NOT delete any users (keep all roles) as requested
  // const removedUsers = await prisma.user.deleteMany({
  //   where: { role: { not: SUPER_ADMIN_ROLE } },
  // });
  const removedUsers = { count: 0 };

  const admins = await prisma.user.findMany({
    where: { role: SUPER_ADMIN_ROLE },
    select: { id: true, email: true, name: true, role: true },
  });

  // Ensure default super admin exists
  const adminEmail = 'admin@gujarmilkshop.com';
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Shehroz',
      password: hashedPassword,
      role: SUPER_ADMIN_ROLE,
      status: 'active',
      assignedScreens: JSON.stringify(ALL_SCREENS),
    },
    create: {
      name: 'Shehroz',
      email: adminEmail,
      password: hashedPassword,
      role: SUPER_ADMIN_ROLE,
      status: 'active',
      assignedScreens: JSON.stringify(ALL_SCREENS),
    },
  });

  // Core inventory products (empty stock)
  const CORE = [
    { code: 'MILK', name: 'Milk', description: 'Fresh milk', unit: 'kg', lowStockThreshold: 10 },
    { code: 'YOGURT', name: 'Yogurt', description: 'Yogurt / dahi', unit: 'kg', lowStockThreshold: 5 },
    { code: 'BUTTER', name: 'Butter', description: 'Butter', unit: 'kg', lowStockThreshold: 2 },
    { code: 'LASSI', name: 'Lassi', description: 'Lassi', unit: 'kg', lowStockThreshold: 5 },
    { code: 'GHEE', name: 'Ghee', description: 'Ghee', unit: 'kg', lowStockThreshold: 2 },
  ] as const;

  for (const item of CORE) {
    await prisma.inventoryProduct.upsert({
      where: { code: item.code },
      update: {
        name: item.name,
        description: item.description,
        isActive: true,
        isLocked: true,
        lowStockThreshold: item.lowStockThreshold,
      },
      create: {
        code: item.code,
        name: item.name,
        description: item.description,
        category: 'Dairy',
        unit: item.unit,
        tax: 'Exempt',
        lowStockThreshold: item.lowStockThreshold,
        isActive: true,
        isLocked: true,
      },
    });
  }

  // Starter daily rates so POS is not Rs 0
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await prisma.dailyRate.create({
    data: {
      milkRate: 200,
      yogurtRate: 180,
      lassiRate: 120,
      butterRate: 800,
      gheeRate: 1200,
      updatedByRole: SUPER_ADMIN_ROLE,
      date: today,
    },
  });

  console.log(`Removed non-admin users: ${removedUsers.count}`);
  console.log('Kept / ensured super_admin:', admins.length ? admins : [{ email: adminEmail }]);
  console.log('Re-seeded: core inventory (0 stock) + default daily rates');
  console.log('Login: admin@gujarmilkshop.com / admin123');
}

wipe()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
