import { Prisma } from '@prisma/client';
import { Migration } from '../types';

/**
 * Migration 018: Add expenseType column to Expense table.
 *
 * Distinguishes Shop Expenses ('SHOP') from Personal Expenses ('PERSONAL').
 * Defaults to 'SHOP' so all historical expense records remain Shop Expenses.
 */
export const migration018AddExpenseType: Migration = {
  version: 18,
  name: 'add_expense_type',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    const cols: Array<{ name: string }> = await tx.$queryRawUnsafe(`PRAGMA table_info("Expense")`);
    const colNames = new Set(cols.map((c) => c.name));

    if (!colNames.has('expenseType')) {
      await tx.$executeRawUnsafe(
        `ALTER TABLE "Expense" ADD COLUMN "expenseType" TEXT NOT NULL DEFAULT 'SHOP'`
      );
      console.log('[MIGRATION v18] Added expenseType column to Expense.');
    } else {
      console.log('[MIGRATION v18] expenseType column already exists on Expense.');
    }

    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Expense_expenseType_idx" ON "Expense"("expenseType")`
    );
    await tx.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "Expense_expenseType_date_idx" ON "Expense"("expenseType", "date")`
    );
    await tx.$executeRawUnsafe(`ANALYZE;`);
  },
};
