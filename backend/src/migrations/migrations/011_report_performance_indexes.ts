import { Prisma } from '@prisma/client';
import { Migration } from '../types';

/**
 * Migration 011: Report performance indexes
 *
 * Adds SQLite indexes on every column touched by hot report queries.
 * Without these, SQLite performs full-table scans on every report load -
 * after a data restore with a large DB this causes P&L to never finish
 * and all other reports to take many seconds.
 */
export const migration011ReportPerformanceIndexes: Migration = {
  version: 11,
  name: 'report_performance_indexes',
  async up(tx: Prisma.TransactionClient): Promise<void> {

    // ── Sale ──────────────────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Sale_createdAt_idx" ON "Sale"("createdAt")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Sale_status_createdAt_idx" ON "Sale"("status", "createdAt")`);

    // ── SaleItem ──────────────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx" ON "SaleItem"("saleId")`);

    // ── Payment ───────────────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Payment_createdAt_idx" ON "Payment"("createdAt")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Payment_method_createdAt_idx" ON "Payment"("method", "createdAt")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Payment_saleId_idx" ON "Payment"("saleId")`);

    // ── Return ────────────────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Return_date_idx" ON "Return"("date")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Return_status_date_idx" ON "Return"("status", "date")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Return_createdAt_idx" ON "Return"("createdAt")`);

    // ── ReturnItem ────────────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReturnItem_returnId_idx" ON "ReturnItem"("returnId")`);

    // ── Expense ───────────────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense"("date")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Expense_category_date_idx" ON "Expense"("category", "date")`);

    // ── ExpensePayment ────────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ExpensePayment_createdAt_idx" ON "ExpensePayment"("createdAt")`);

    // ── InventoryMovement ─────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InventoryMovement_productId_date_idx" ON "InventoryMovement"("productId", "date")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InventoryMovement_date_idx" ON "InventoryMovement"("date")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InventoryMovement_movementType_date_idx" ON "InventoryMovement"("movementType", "date")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "InventoryMovement_productId_unitCost_idx" ON "InventoryMovement"("productId", "unitCost")`);

    // ── MilkProductDailyStock ─────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "MilkProductDailyStock_date_idx" ON "MilkProductDailyStock"("date")`);

    // ── ButterGheeConversion ──────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ButterGheeConversion_date_idx" ON "ButterGheeConversion"("date")`);

    // ── SupplierCollection ────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupplierCollection_date_idx" ON "SupplierCollection"("date")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupplierCollection_supplierId_date_idx" ON "SupplierCollection"("supplierId", "date")`);

    // ── SupplierPayment ───────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupplierPayment_createdAt_idx" ON "SupplierPayment"("createdAt")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId")`);

    // ── Shift ─────────────────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Shift_startTime_idx" ON "Shift"("startTime")`);

    // ── CashbookTransaction ───────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CashbookTransaction_createdAt_idx" ON "CashbookTransaction"("createdAt")`);
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CashbookTransaction_transactionType_createdAt_idx" ON "CashbookTransaction"("transactionType", "createdAt")`);

    // ── SyncQueue ─────────────────────────────────────────────────────────────
    await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SyncQueue_status_createdAt_idx" ON "SyncQueue"("status", "createdAt")`);

    // Run ANALYZE so SQLite immediately uses the new indexes
    await tx.$executeRawUnsafe(`ANALYZE`);

    console.log('[MIGRATION v11] Report performance indexes created and ANALYZE complete.');
  },
};
