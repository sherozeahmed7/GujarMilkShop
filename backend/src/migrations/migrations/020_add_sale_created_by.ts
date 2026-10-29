import { Prisma } from '@prisma/client';
import { Migration } from '../types';

/**
 * Migration 020: Add createdById to Sale table
 *
 * Adds a nullable foreign-key column `createdById` to the Sale table so we can
 * track which user (cashier / staff member) created each sale.
 * Legacy rows will have NULL for this column.
 */
export const migration020AddSaleCreatedBy: Migration = {
  version: 20,
  name: 'add_sale_created_by',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    const saleCols: Array<{ name: string }> = await tx.$queryRawUnsafe(
      `PRAGMA table_info("Sale")`
    );
    const saleColNames = new Set(saleCols.map((c) => c.name));

    if (!saleColNames.has('createdById')) {
      await tx.$executeRawUnsafe(
        `ALTER TABLE "Sale" ADD COLUMN "createdById" INTEGER REFERENCES "User"("id")`
      );
      console.log('[MIGRATION v20] Added createdById column to Sale table.');
    }

    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_createdById_idx"
      ON "Sale"("createdById");
    `);

    console.log('[MIGRATION v20] Sale.createdById column and index verified.');
  },
};
