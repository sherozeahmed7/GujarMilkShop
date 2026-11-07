import { Prisma } from '@prisma/client';
import { Migration } from '../types';

export const migration023ExpenseCustomerCategory: Migration = {
  version: 23,
  name: 'add_expense_customer_category',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    const cols: Array<{ name: string }> = await tx.$queryRawUnsafe(`PRAGMA table_info("ExpenseCustomer")`);
    const colNames = new Set(cols.map((c) => c.name));

    if (!colNames.has('customerCategory')) {
      await tx.$executeRawUnsafe(
        `ALTER TABLE "ExpenseCustomer" ADD COLUMN "customerCategory" TEXT NOT NULL DEFAULT 'SHOP'`
      );
      console.log('[MIGRATION v23] Added customerCategory column to ExpenseCustomer.');
    } else {
      console.log('[MIGRATION v23] customerCategory column already exists on ExpenseCustomer.');
    }

    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "ExpenseCustomer_customerCategory_idx" ON "ExpenseCustomer"("customerCategory")`
    );
  },
};

