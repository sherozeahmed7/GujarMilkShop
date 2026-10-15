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
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
      select: { id: true },
    });

    if (!existingAdmin) {
      const hashedPassword = await hashPassword('admin123');
      await prisma.user.create({
        data: {
          name: 'Shehroz',
          email: adminEmail,
          password: hashedPassword,
          role: SUPER_ADMIN_ROLE,
          status: 'active',
          assignedScreens: JSON.stringify(ALL_SCREENS)
        }
      });
    }

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
    const { SyncQueueService } = await import('../services/syncQueue.service');
    for (const item of CORE_INVENTORY_PRODUCTS) {
      let product = await prisma.inventoryProduct.findUnique({
        where: { code: item.code },
      });

      if (!product) {
        product = await prisma.inventoryProduct.create({
          data: {
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

      // Ensure cloud mapping exists so inventory movements can resolve product_uuid
      const mapped = await SyncQueueService.getCloudMapping('InventoryProduct', product.id);
      if (!mapped) {
        await SyncQueueService.enqueueUpdate(
          prisma,
          'InventoryProduct',
          product.id,
          product,
          0,
          'UPSERT'
        );
      }
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
 * Connects to the database and logs status details
 */
export async function connectDB() {
  try {
    // Attempt database connection
    await prisma.$connect();
    console.log('Database connected successfully');

    // Configure production SQLite PRAGMA settings for maximum reliability, concurrency, and performance
    // Note: In Prisma + SQLite, any PRAGMA that returns rows/values must be invoked with $queryRawUnsafe
    await prisma.$queryRawUnsafe(`PRAGMA journal_mode = WAL;`);
    await prisma.$queryRawUnsafe(`PRAGMA busy_timeout = 5000;`);
    await prisma.$queryRawUnsafe(`PRAGMA cache_size = -64000;`);
    await prisma.$queryRawUnsafe(`PRAGMA temp_store = MEMORY;`);
    await prisma.$queryRawUnsafe(`PRAGMA mmap_size = 268435456;`);
    await prisma.$queryRawUnsafe(`PRAGMA synchronous = NORMAL;`);
    await prisma.$executeRawUnsafe(`PRAGMA foreign_keys = ON;`);

    // Run versioned schema and data migrations with backup, locks, transactions, and verification
    const { preparePendingDataMigrations, runPendingDataMigrations } = await import('../migrations/migrationRunner');
    const preparedMigrations = await preparePendingDataMigrations(prisma);
    await runPendingDataMigrations(prisma, preparedMigrations);

    // Run query planner optimization on restored or active databases
    try {
      await prisma.$queryRawUnsafe(`PRAGMA optimize;`);
    } catch {
      // Non-fatal if optimize fails
    }

    // Auto-seed default super_admin user
    await seedSuperAdmin();
    await seedCoreInventoryProducts();
    await seedDefaultDailyRates();
  } catch (error) {
    console.error('❌ Database upgrade could not be completed safely. Your data was not changed. A backup has been preserved. Please contact support.');
    console.error('[Database] Technical startup error:', error);
    process.exit(1);
  }
}
