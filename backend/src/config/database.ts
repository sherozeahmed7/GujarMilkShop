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

/**
 * Connects to the database and logs status details
 */
export async function connectDB() {
  try {
    // Attempt database connection
    await prisma.$connect();
    console.log('Database connected successfully');

    // Auto-seed default super_admin user
    await seedSuperAdmin();
  } catch (error) {
    console.error('❌ Failed to connect to the database:', error);
    process.exit(1);
  }
}
