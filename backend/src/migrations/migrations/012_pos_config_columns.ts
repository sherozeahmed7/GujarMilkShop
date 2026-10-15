import { Prisma } from '@prisma/client';
import { Migration } from '../types';

/**
 * Migration 012: Ensure POSConfig columns exist (e.g. printMode, autoClearCartAfterSale, etc.)
 */
export const migration012POSConfigColumns: Migration = {
  version: 12,
  name: 'pos_config_columns',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // Check existing columns on POSConfig table
    const cols: Array<{ name: string }> = await tx.$queryRawUnsafe(`PRAGMA table_info("POSConfig")`);
    const colNames = new Set(cols.map((c) => c.name));

    if (!colNames.has('printMode')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "printMode" TEXT NOT NULL DEFAULT 'raster'`);
    }

    if (!colNames.has('showDailyRateOnPOS')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "showDailyRateOnPOS" BOOLEAN NOT NULL DEFAULT 1`);
    }

    if (!colNames.has('showCartSubtotal')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "showCartSubtotal" BOOLEAN NOT NULL DEFAULT 1`);
    }

    if (!colNames.has('confirmBeforeSale')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "confirmBeforeSale" BOOLEAN NOT NULL DEFAULT 0`);
    }

    if (!colNames.has('autoClearCartAfterSale')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "autoClearCartAfterSale" BOOLEAN NOT NULL DEFAULT 0`);
    }

    if (!colNames.has('showLogoOnReceipt')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "showLogoOnReceipt" BOOLEAN NOT NULL DEFAULT 0`);
    }

    if (!colNames.has('receiptFooterText')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "receiptFooterText" TEXT NOT NULL DEFAULT 'Thank you for your visit!'`);
    }

    if (!colNames.has('receiptWidth')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "receiptWidth" TEXT NOT NULL DEFAULT '80mm'`);
    }

    if (!colNames.has('printerEnabled')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "printerEnabled" BOOLEAN NOT NULL DEFAULT 1`);
    }

    if (!colNames.has('printerName')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "printerName" TEXT NOT NULL DEFAULT 'Black Copper BC-105'`);
    }

    if (!colNames.has('autoCutter')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "autoCutter" BOOLEAN NOT NULL DEFAULT 1`);
    }

    if (!colNames.has('cashDrawer')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "cashDrawer" BOOLEAN NOT NULL DEFAULT 0`);
    }

    if (!colNames.has('requireCustomerName')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "requireCustomerName" BOOLEAN NOT NULL DEFAULT 0`);
    }

    if (!colNames.has('allowDiscount')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "allowDiscount" BOOLEAN NOT NULL DEFAULT 1`);
    }

    if (!colNames.has('maxDiscountPercent')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "maxDiscountPercent" REAL NOT NULL DEFAULT 10`);
    }

    if (!colNames.has('defaultPaymentMethod')) {
      await tx.$executeRawUnsafe(`ALTER TABLE "POSConfig" ADD COLUMN "defaultPaymentMethod" TEXT NOT NULL DEFAULT 'cash'`);
    }

    console.log('[MIGRATION v12] POSConfig table columns verified/migrated.');
  },
};
