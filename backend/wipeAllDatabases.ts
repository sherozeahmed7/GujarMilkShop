import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import os from 'os';
import bcrypt from 'bcryptjs';

const appDataBase = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
const appDataDbPath = path.join(appDataBase, 'com.shero.tauri-app', 'pos.db');
const localDevDbPath = path.join(process.cwd(), 'prisma', 'dev.db');

const targetDbPaths = [
  appDataDbPath,
  localDevDbPath
].filter(p => fs.existsSync(p));

console.log('Target SQLite databases found:', targetDbPaths);

const SUPER_ADMIN_ROLE = process.env.SUPER_ADMIN_ROLE || 'super_admin';
const ALL_SCREENS = [
  'Dashboard', 'POS', 'Suppliers', 'Customers', 'Inventory', 'Expenses', 'Returns',
  'Khata', 'Reports', 'Shifts', 'Audit', 'Register', 'Cashbook', 'Daily Rates',
  'Users', 'Settings', 'Cloud Sync', 'POS Config'
];

async function wipeDatabase(dbFilePath: string) {
  console.log(`\n--- Wiping database at: ${dbFilePath} ---`);
  const client = new PrismaClient({
    datasources: {
      db: {
        url: `file:${dbFilePath}`
      }
    }
  });

  try {
    await client.$connect();

    // Check counts before
    const salesBefore = await client.sale.count();
    const customersBefore = await client.customer.count();
    const suppliersBefore = await client.supplier.count();
    const shiftsBefore = await client.shift.count();
    const expensesBefore = await client.expense.count();
    const syncQueueBefore = await client.syncQueue.count();
    console.log(`Before wipe: ${salesBefore} sales, ${customersBefore} customers, ${suppliersBefore} suppliers, ${shiftsBefore} shifts, ${expensesBefore} expenses, ${syncQueueBefore} syncQueue`);

    // Wipe leaf tables first
    await client.expensePayment.deleteMany();
    await client.expense.deleteMany();
    await client.returnItem.deleteMany();
    await client.return.deleteMany();
    await client.payment.deleteMany();
    await client.saleItem.deleteMany();
    await client.sale.deleteMany();
    await client.customer.deleteMany();
    await client.inventoryMovement.deleteMany();
    await client.supplierCollection.deleteMany();
    await client.supplierPayment.deleteMany();
    await client.supplier.deleteMany();
    await client.heldCart.deleteMany();
    await client.milkProductTransaction.deleteMany();
    await client.butterGheeConversion.deleteMany();
    await client.milkProductDailyStock.deleteMany();
    await client.auditRecord.deleteMany();
    await client.shift.deleteMany();
    await client.dailyRate.deleteMany();
    await client.inventoryProduct.deleteMany();

    // Sync / mappings / state
    await client.syncQueue.deleteMany();
    await client.localToCloudMapping.deleteMany();
    await client.downstreamAppliedEvent.deleteMany();
    await client.downstreamSyncState.deleteMany();
    await client.cloudSyncSettings.deleteMany();
    await client.pOSConfig.deleteMany();

    // Remove non-super-admin users
    await client.user.deleteMany({
      where: { role: { not: SUPER_ADMIN_ROLE } }
    });

    // Seed/ensure super admin
    const adminEmail = 'admin@gujarmilkshop.com';
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await client.user.upsert({
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

    // Core inventory items
    const CORE = [
      { code: 'MILK', name: 'Milk', description: 'Fresh milk', unit: 'kg', lowStockThreshold: 10 },
      { code: 'YOGURT', name: 'Yogurt', description: 'Yogurt / dahi', unit: 'kg', lowStockThreshold: 5 },
      { code: 'BUTTER', name: 'Butter', description: 'Butter', unit: 'kg', lowStockThreshold: 2 },
      { code: 'LASSI', name: 'Lassi', description: 'Lassi', unit: 'kg', lowStockThreshold: 5 },
      { code: 'GHEE', name: 'Ghee', description: 'Ghee', unit: 'kg', lowStockThreshold: 2 },
    ] as const;

    for (const item of CORE) {
      await client.inventoryProduct.upsert({
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

    // Default daily rates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await client.dailyRate.create({
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

    // Check counts after
    const salesAfter = await client.sale.count();
    const customersAfter = await client.customer.count();
    const suppliersAfter = await client.supplier.count();
    const shiftsAfter = await client.shift.count();
    const syncQueueAfter = await client.syncQueue.count();
    console.log(`After wipe: ${salesAfter} sales, ${customersAfter} customers, ${suppliersAfter} suppliers, ${shiftsAfter} shifts, ${syncQueueAfter} syncQueue`);
    console.log(`✅ Successfully wiped and re-seeded: ${dbFilePath}`);

  } catch (err: any) {
    console.error(`❌ Error wiping ${dbFilePath}:`, err.message);
  } finally {
    await client.$disconnect();
  }
}

async function runAll() {
  for (const p of targetDbPaths) {
    await wipeDatabase(p);
  }
}

runAll().then(() => {
  console.log('\nAll databases wiped and synchronized.');
  process.exit(0);
});
