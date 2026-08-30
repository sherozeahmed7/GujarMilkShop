import { prisma } from './config/database';
import fs from 'fs';
import path from 'path';

async function performBackupAndInventory() {
  console.log('--- Phase 3: Backup and Inventory ---');

  // 1. Verify and Backup DB
  // Prisma file path based on DATABASE_URL="file:./prisma/dev.db" from inside the prisma folder
  const dbPath = path.join(process.cwd(), 'prisma', 'prisma', 'dev.db');
  const backupPath = path.join(process.cwd(), 'prisma', 'prisma', 'dev_backup.db');
  
  if (fs.existsSync(dbPath)) {
    console.log(`[OK] Found active SQLite DB at: ${dbPath}`);
    // Do not overwrite an existing backup for safety
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(dbPath, backupPath);
      console.log(`[OK] Successfully backed up to: ${backupPath}`);
    } else {
      console.log(`[OK] Existing backup found at: ${backupPath}. Not overwriting.`);
    }
  } else {
    console.error(`[ERROR] Database not found at: ${dbPath}`);
    return;
  }

  // 2. Inventory counts
  console.log('\n--- SQLite Record Counts ---');
  const models = [
    'user',
    'supplier',
    'supplierCollection',
    'supplierPayment',
    'inventoryProduct',
    'inventoryMovement',
    'shift',
    'heldCart',
    'dailyRate',
    'customer',
    'sale',
    'saleItem',
    'payment',
    'milkProductDailyStock',
    'milkProductTransaction',
    'butterGheeConversion',
    'expense',
    'expensePayment',
    'return',
    'returnItem',
    'auditRecord'
  ];

  for (const model of models) {
    try {
      // @ts-ignore
      const count = await prisma[model].count();
      console.log(`${model}: ${count}`);
    } catch (e: any) {
      console.error(`Failed to count ${model}:`, e.message);
    }
  }
}

performBackupAndInventory().finally(() => prisma.$disconnect());
