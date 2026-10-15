import { Prisma } from '@prisma/client';
import { Migration } from '../types';

export const migration005ConsolidateF2AndRemoveMilkProductTransaction: Migration = {
  version: 5,
  name: 'consolidate_f2_and_remove_milk_product_transaction',
  async up(tx: Prisma.TransactionClient): Promise<void> {
    // 1. Inspect if MilkProductTransaction table exists
    const tables = await tx.$queryRawUnsafe<Array<{ name: string }>>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='MilkProductTransaction'`
    );

    if (tables.length > 0) {
      // 2. Fetch existing rows to verify if any need migration to InventoryMovement
      const existingRows: any[] = await tx.$queryRawUnsafe(
        `SELECT * FROM "MilkProductTransaction"`
      );

      // Find core inventory products
      const products: any[] = await tx.$queryRawUnsafe(
        `SELECT id, code, name FROM "InventoryProduct"`
      );
      const productMap: Record<string, number> = {};
      for (const p of products) {
        if (p.code) productMap[p.code.toUpperCase()] = p.id;
        if (p.name) productMap[p.name.toUpperCase()] = p.id;
      }

      for (const row of existingRows) {
        if (!row.reference) {
          // Dev test row without reference: create unique deterministic reference
          const prodCode = (row.product || 'MILK').toUpperCase();
          const prodId = productMap[prodCode] || productMap['MILK'];
          const ref = `legacy-mpt-${row.id}-${prodCode.toLowerCase()}`;

          // Check if already in InventoryMovement
          const existingMove: any[] = await tx.$queryRawUnsafe(
            `SELECT id FROM "InventoryMovement" WHERE reference = ?`,
            ref
          );

          if (existingMove.length === 0 && prodId) {
            let movementType = 'CONVERSION';
            let qty = Number(row.quantity) || 0;
            if (row.type === 'milk_added') {
              qty = -Math.abs(qty);
            } else if (row.type.includes('produced')) {
              qty = Math.abs(qty);
            } else if (row.type.includes('sold')) {
              qty = -Math.abs(qty);
            }

            await tx.$executeRawUnsafe(
              `INSERT INTO "InventoryMovement" (
                "productId", "quantity", "movementType", "source", "reference", "date", "createdAt"
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              prodId,
              qty,
              movementType,
              `F2 Legacy ${row.type}`,
              ref,
              row.date || row.createdAt,
              row.createdAt || new Date().toISOString()
            );
          }
        }
      }

      // 3. Drop the redundant MilkProductTransaction table from SQLite
      await tx.$executeRawUnsafe(`DROP TABLE IF EXISTS "MilkProductTransaction"`);
      console.log('[MIGRATION] Dropped table "MilkProductTransaction" from SQLite.');
    }
  },
};
