/**
 * generate-template-db.ts
 *
 * Generates a clean, fully-migrated, pre-seeded SQLite database template (template.db).
 * This template is packaged with Tauri and copied to %APPDATA%/com.shero.tauri-app/pos.db
 * on fresh client installations.
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prismaDir = path.resolve(__dirname, '../prisma');
const schemaPath = path.join(prismaDir, 'schema.prisma');
const templateDbPath = path.join(prismaDir, 'template.db');

async function main() {
  console.log('🔄 [Template DB] Starting generation...');

  // 1. Remove old template.db if exists to start fresh
  if (fs.existsSync(templateDbPath)) {
    try {
      fs.unlinkSync(templateDbPath);
    } catch (_) {}
  }

  // 2. Run prisma db push directly to create all tables
  const dbUrl = `file:${templateDbPath.replace(/\\/g, '/')}`;
  console.log(`📦 [Template DB] Pushing schema to: ${dbUrl}`);

  execSync(`npx prisma db push --schema="${schemaPath}" --accept-data-loss --skip-generate`, {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
    },
    stdio: 'inherit',
  });

  // 3. Connect to template.db and seed default admin + core products + starter rates
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

  try {
    await prisma.$connect();
    console.log('✅ [Template DB] Connected to newly created template.db');

    const SUPER_ADMIN_ROLE = 'super_admin';
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
      'Cashbook',
      'Expenses',
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
      'Daily Rates',
      'Shop Info',
      'POS Config',
      'Users & Roles',
      'Cloud & Sync',
      'Local Backup',
    ];

    // Seed default super admin
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
    console.log('👤 [Template DB] Default Super Admin seeded');

    // Seed core dairy inventory items
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
    console.log('📦 [Template DB] Core Inventory items seeded');

    // Seed starter daily rates
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
    console.log('💰 [Template DB] Starter Daily Rates seeded');

  } finally {
    await prisma.$disconnect();
  }

  // 4. Verify file exists and has healthy size
  if (!fs.existsSync(templateDbPath)) {
    throw new Error(`Failed to generate template.db at ${templateDbPath}`);
  }

  const stat = fs.statSync(templateDbPath);
  console.log(`🎉 [Template DB] Successfully created template.db (${stat.size} bytes)`);

  if (stat.size < 10000) {
    throw new Error(`template.db is abnormally small (${stat.size} bytes)!`);
  }
}

main().catch((err) => {
  console.error('❌ [Template DB] Failed to generate template.db:', err);
  process.exit(1);
});
