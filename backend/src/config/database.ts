import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/auth';

// Instantiate PrismaClient to interact with SQLite database
export const prisma = new PrismaClient();

// List of all frontend screen names extracted from the Sidebar component
const ALL_SCREENS = [
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
  'Backup',
  'Expenses',
  'Settings',
  'Sales Report',
  'Supplier Report',
  'Customer Report',
  'Inventory Report',
  'Returns Report',
  'Cash Register Report',
  'Shifts Report',
  'Expenses Report',
  'Backup Report',
  'Profit & Loss',
  'Activity Logs'
];

/**
 * Seeds a default super_admin user into the database if not already present.
 */
async function seedSuperAdmin() {
  try {
    const adminEmail = 'admin@gujarmilkshop.com';
    
    // Check if super_admin user already exists in SQLite DB
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!existingAdmin) {
      // Hash the plain-text password using bcrypt before saving to DB
      const hashedPassword = await hashPassword('admin123');

      // Create super_admin record
      await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          role: 'super_admin',
          assignedScreens: JSON.stringify(ALL_SCREENS) // Stored as JSON string array
        }
      });

      console.log('👤 Default super_admin created: admin@gujarmilkshop.com / admin123');
    }
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
