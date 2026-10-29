import { Prisma } from '@prisma/client';
import { Migration } from '../types';

/**
 * Migration 019: Ensure Sale Discount and Token Columns Exist
 *
 * Adds missing columns on Sale table (discountAmount, tokenNumber, cloudUuid)
 * and verifies Shift and DailyRate columns on existing customer databases.
 */
export const migration019AddSaleDiscountAndTokenColumns: Migration = {
  version: 19,
  name: 'add_sale_discount_and_token_columns',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // 1. Verify and migrate Sale table columns
    const saleCols: Array<{ name: string }> = await tx.$queryRawUnsafe(`PRAGMA table_info("Sale")`);
    const saleColNames = new Set(saleCols.map((c) => c.name));

    if (!saleColNames.has('discountAmount')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN "discountAmount" REAL NOT NULL DEFAULT 0`);
      console.log('[MIGRATION v19] Added discountAmount column to Sale table.');
    }

    if (!saleColNames.has('tokenNumber')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN "tokenNumber" INTEGER NOT NULL DEFAULT 0`);
      console.log('[MIGRATION v19] Added tokenNumber column to Sale table.');
    }

    if (!saleColNames.has('cloudUuid')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "Sale" ADD COLUMN "cloudUuid" TEXT`);
      console.log('[MIGRATION v19] Added cloudUuid column to Sale table.');
    }

    // 2. Ensure indexes on Sale table exist
    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_createdAt_tokenNumber_idx"
      ON "Sale"("createdAt", "tokenNumber");
    `);

    await tx.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Sale_tokenNumber_idx"
      ON "Sale"("tokenNumber");
    `);

    // 3. Verify Shift table columns
    const shiftCols: Array<{ name: string }> = await tx.$queryRawUnsafe(`PRAGMA table_info("Shift")`);
    const shiftColNames = new Set(shiftCols.map((c) => c.name));

    if (!shiftColNames.has('difference')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "Shift" ADD COLUMN "difference" REAL`);
    }
    if (!shiftColNames.has('differenceStatus')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "Shift" ADD COLUMN "differenceStatus" TEXT`);
    }
    if (!shiftColNames.has('cloudUuid')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "Shift" ADD COLUMN "cloudUuid" TEXT`);
    }

    // 4. Verify DailyRate table columns
    const rateCols: Array<{ name: string }> = await tx.$queryRawUnsafe(`PRAGMA table_info("DailyRate")`);
    const rateColNames = new Set(rateCols.map((c) => c.name));

    if (!rateColNames.has('lassiRate')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "DailyRate" ADD COLUMN "lassiRate" REAL NOT NULL DEFAULT 0`);
    }
    if (!rateColNames.has('butterRate')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "DailyRate" ADD COLUMN "butterRate" REAL NOT NULL DEFAULT 0`);
    }
    if (!rateColNames.has('gheeRate')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "DailyRate" ADD COLUMN "gheeRate" REAL NOT NULL DEFAULT 0`);
    }
    if (!rateColNames.has('cloudUuid')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "DailyRate" ADD COLUMN "cloudUuid" TEXT`);
    }

    // 5. Verify Customer cloudUuid
    const custCols: Array<{ name: string }> = await tx.$queryRawUnsafe(`PRAGMA table_info("Customer")`);
    const custColNames = new Set(custCols.map((c) => c.name));
    if (!custColNames.has('cloudUuid')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "Customer" ADD COLUMN "cloudUuid" TEXT`);
    }

    await tx.$executeRawUnsafe(`ANALYZE;`);
    console.log('[MIGRATION v19] Sale discountAmount and required operational columns verified successfully.');
  },
};
