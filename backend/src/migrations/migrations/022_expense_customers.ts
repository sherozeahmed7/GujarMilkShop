import { Prisma } from '@prisma/client';
import { Migration } from '../types';

export const migration022ExpenseCustomers: Migration = {
  version: 22,
  name: 'add_expense_customers',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    await tx.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ExpenseCustomer" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" TEXT NOT NULL,
        "phone" TEXT,
        "notes" TEXT,
        "status" TEXT NOT NULL DEFAULT 'active',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ExpenseCustomer_name_idx" ON "ExpenseCustomer"("name");
    `);
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "ExpenseCustomer_status_idx" ON "ExpenseCustomer"("status");
    `);
  },
};

