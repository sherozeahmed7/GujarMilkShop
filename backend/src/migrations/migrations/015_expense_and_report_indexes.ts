import { Prisma } from '@prisma/client';
import { Migration } from '../types';

/**
 * Migration 015: Expense & Report Query Performance Indexes
 *
 * Adds targeted indexes for queries newly introduced in the Phase 3
 * report N+1 fix:
 *
 * 1. Expense.date — used by Cash Register report (`{ date: { in: shiftDates } }`)
 * 2. Expense.category — used by expenses report GROUP BY category
 * 3. Sale.customerId + remainingBalance — covering index for outstanding
 *    balance scan (supplements 014 which has customerId+status+remainingBalance)
 * 4. Sale.customerId + remainingBalance (partial covering without status) so
 *    `WHERE customerId IS NOT NULL AND remainingBalance > 0` can use index.
 *
 * Uses CREATE INDEX IF NOT EXISTS so safe to run on databases that already
 * have these indexes from any manual creation.
 */
export const migration015ExpenseAndReportIndexes: Migration = {
  version: 15,
  name: 'expense_and_report_indexes',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // 1. Expense date index — Cash Register report date-range lookup
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Expense_date_idx"
      ON "Expense"("date");
    `);

    // 2. Expense category index — expenses report category breakdown
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Expense_category_idx"
      ON "Expense"("category");
    `);

    // 3. Sale outstanding balance index — customer report outstanding scan
    //    WHERE customerId IS NOT NULL AND remainingBalance > 0
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_customerId_remainingBalance_idx"
      ON "Sale"("customerId", "remainingBalance");
    `);

    // 4. Refresh query planner statistics
    await tx.$executeRawUnsafe(`ANALYZE;`);

    console.log('[MIGRATION v15] Expense and report performance indexes created successfully.');
  },
};
