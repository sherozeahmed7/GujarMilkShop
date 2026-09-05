import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/auth';
import { SUPER_ADMIN_ROLE } from './constants';
// Instantiate PrismaClient to interact with SQLite database
export const prisma = new PrismaClient();

if (!('heldCart' in prisma)) {
  throw new Error('Prisma client is out of sync. Run "npx prisma generate" and restart the backend.');
}

/**
 * Pre-defined list of all available application screens/modules
 * Used to initialize the super_admin with full access.
 */
export const ALL_SCREENS = [
  // Dashboard & Core Operations
  'Dashboard',
  'Point of Sale',
  'Inventory',
  'Suppliers',
  'Customers',
  'Khata / Ledger',
  'Returns',
  'Receipt Audit',
  'Shifts',
  'Cash Register',
  'Cashbook',
  'Expenses',

  // Reports
  'Sales Report',
  'F2 Sales Report',
  'Supplier Report',
  'Customer Report',
  'Inventory Report',
  'Returns Report',
  'Cash Register Report',
  'Shifts Report',
  'Expenses Report',
  'Backup Report',
  'Profit & Loss',
  'Activity Logs',

  // Settings
  'Daily Rates',
  'Shop Info',
  'POS Config',
  'Users & Roles',
  'Cloud & Sync',
  'Local Backup',
];

/**
 * Seeds a default super_admin user into the database if not already present.
 */
async function seedSuperAdmin() {
  try {
    const adminEmail = 'admin@gujarmilkshop.com';
    const hashedPassword = await hashPassword('admin123');

    // Upsert super_admin user to guarantee account exists with valid bcrypt password
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        name: 'Shehroz',
        password: hashedPassword,
        role: SUPER_ADMIN_ROLE,
        status: 'active',
        assignedScreens: JSON.stringify(ALL_SCREENS)
      },
      create: {
        name: 'Shehroz',
        email: adminEmail,
        password: hashedPassword,
        role: SUPER_ADMIN_ROLE,
        status: 'active',
        assignedScreens: JSON.stringify(ALL_SCREENS)
      }
    });

    console.log(`👤 Super Admin ready: Shehroz (admin@gujarmilkshop.com / admin123) Role: ${SUPER_ADMIN_ROLE}`);
  } catch (error) {
    console.error('⚠️ Error seeding super_admin user:', error);
  }
}

/** Core shop items — always present in inventory; locked so they cannot be deleted. */
const CORE_INVENTORY_PRODUCTS = [
  { code: 'MILK', name: 'Milk', description: 'Fresh milk', unit: 'kg', lowStockThreshold: 10 },
  { code: 'YOGURT', name: 'Yogurt', description: 'Yogurt / dahi', unit: 'kg', lowStockThreshold: 5 },
  { code: 'BUTTER', name: 'Butter', description: 'Butter', unit: 'kg', lowStockThreshold: 2 },
  { code: 'LASSI', name: 'Lassi', description: 'Lassi', unit: 'kg', lowStockThreshold: 5 },
  { code: 'GHEE', name: 'Ghee', description: 'Ghee', unit: 'kg', lowStockThreshold: 2 },
] as const;

async function seedCoreInventoryProducts() {
  try {
    for (const item of CORE_INVENTORY_PRODUCTS) {
      await prisma.inventoryProduct.upsert({
        where: { code: item.code },
        update: {
          name: item.name,
          description: item.description,
          category: 'Dairy',
          unit: item.unit,
          tax: 'Exempt',
          lowStockThreshold: item.lowStockThreshold,
          isActive: true,
          isLocked: true,
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
    console.log('📦 Core inventory ready: Milk, Yogurt, Butter, Lassi, Ghee');
  } catch (error) {
    console.error('⚠️ Error seeding core inventory products:', error);
  }
}

/** Seed starter daily rates only when the table is empty (so POS prices are not Rs. 0). */
async function seedDefaultDailyRates() {
  try {
    const count = await prisma.dailyRate.count();
    if (count > 0) return;

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
    console.log(
      '💰 Default daily rates seeded: Milk 200, Yogurt 180, Lassi 120, Butter 800, Ghee 1200 (edit in Daily Rates)'
    );
  } catch (error) {
    console.error('⚠️ Error seeding default daily rates:', error);
  }
}

/**
 * Automatically migrate SQLite schema differences on startup
 * so existing client installations don't crash when new columns are added.
 */
async function runAutoMigrations() {
  try {
    // Check Sale table for tokenNumber
    const saleColumns: any[] = await prisma.$queryRawUnsafe(`PRAGMA table_info("Sale")`);
    const hasTokenNumber = saleColumns.some((col: any) => col.name === 'tokenNumber');
    if (!hasTokenNumber) {
      console.log('🔄 Auto-migrating: Adding tokenNumber column to Sale table...');
      await prisma.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN "tokenNumber" INTEGER NOT NULL DEFAULT 0`);
      console.log('✅ tokenNumber column added to Sale table successfully.');
    }
  } catch (error) {
    console.error('⚠️ Auto-migration notice:', error);
  }
}

/**
 * Connects to the database and logs status details
 */
export async function connectDB() {
  try {
    // Attempt database connection
    await prisma.$connect();
    console.log('Database connected successfully');

    // Run auto-migrations for SQLite schema updates
    await runAutoMigrations();

    // Auto-seed default super_admin user
    await seedSuperAdmin();
    await seedCoreInventoryProducts();
    await seedDefaultDailyRates();
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
    process.exit(1);
  }
}

