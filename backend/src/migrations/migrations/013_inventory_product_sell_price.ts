import { Prisma } from '@prisma/client';
import { Migration } from '../types';

/**
 * Migration 013: Add sellPrice column to InventoryProduct.
 *
 * Standard products (milk, yogurt, lassi, butter, ghee) continue to pull their
 * sell price dynamically from DailyRate at query time.  All other (generic)
 * products now store a fixed sell price directly on the product row so that:
 *   - A user can set it when creating the product (no DailyRate entry needed).
 *   - Edits to the product sell price are persisted independently of DailyRate.
 */
export const migration013InventoryProductSellPrice: Migration = {
  version: 13,
  name: 'inventory_product_sell_price',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    const cols: Array<{ name: string }> = await tx.$queryRawUnsafe(`PRAGMA table_info("InventoryProduct")`);
    const colNames = new Set(cols.map((c) => c.name));

    if (!colNames.has('sellPrice')) {
      await tx.$executeRawUnsafe(
        `ALTER TABLE "InventoryProduct" ADD COLUMN "sellPrice" REAL NOT NULL DEFAULT 0`
      );
      console.log('[MIGRATION v13] Added sellPrice column to InventoryProduct.');
    } else {
      console.log('[MIGRATION v13] sellPrice column already exists on InventoryProduct.');
    }
  },
};
