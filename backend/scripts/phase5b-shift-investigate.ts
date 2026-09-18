/**
 * Phase 5B — Shift Sync Root-Cause Investigation
 * READ-ONLY. Nothing is modified.
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function run() {
  const neon = await pool.connect();
  const report: any = {
    allShifts: [],
    shiftTrace: [],
    queueEventsForShifts: [],
    genericMappingCheck: { broken: [] },
    neonShiftsRaw: [],
    userCheck: [],
    syncedSampleEntities: {}
  };

  try {
    // ── PART 1: All SQLite Shifts ──────────────────────────────────────────────
    const shifts = await prisma.shift.findMany({ orderBy: { id: 'asc' } });
    report.allShifts = shifts;

    // ── PART 2 & 3: Mapping trace + Neon row existence for every Shift ─────────
    for (const shift of shifts) {
      const mapping = await prisma.localToCloudMapping.findFirst({
        where: { entityType: 'Shift', localId: shift.id }
      });

      let neonExists = false;
      let neonRow: any = null;
      if (mapping) {
        const neonRes = await neon.query('SELECT * FROM shifts WHERE id = $1', [mapping.cloudUuid]);
        neonExists = neonRes.rows.length > 0;
        neonRow = neonRes.rows[0] || null;
      }

      // Find queue events
      const queueEvents = await prisma.syncQueue.findMany({
        where: { entityType: 'Shift', localId: shift.id }
      });

      report.shiftTrace.push({
        localId: shift.id,
        shiftDate: shift.shiftDate,
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        openedById: shift.openedById,
        closedById: shift.closedById,
        mappingExists: !!mapping,
        cloudUuid: mapping?.cloudUuid || null,
        deviceId: mapping?.deviceId || null,
        neonExists,
        neonRow: neonRow ? {
          id: neonRow.id,
          device_id: neonRow.device_id,
          local_id: neonRow.local_id,
          shift_date: neonRow.shift_date,
          status: neonRow.status,
          opened_by_uuid: neonRow.opened_by_uuid,
          closed_by_uuid: neonRow.closed_by_uuid
        } : null,
        queueEvents: queueEvents.map(e => ({
          eventUuid: e.eventUuid,
          operation: e.operation,
          status: e.status,
          layer: e.layer,
          retryCount: e.retryCount,
          error: e.error,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          payloadSnippet: (() => {
            try {
              const p = JSON.parse(e.payload);
              // Pull FK fields for diagnosis
              return {
                shift_date: p.shift_date || p.shiftDate,
                status: p.status,
                opened_by_id: p.openedById,
                closed_by_id: p.closedById,
                opened_by_uuid: p.opened_by_uuid,
                closed_by_uuid: p.closed_by_uuid
              };
            } catch { return e.payload.substring(0, 200); }
          })()
        }))
      });
    }

    // ── Raw Neon Shifts ────────────────────────────────────────────────────────
    const neonShifts = await neon.query('SELECT id, device_id, local_id, shift_date, status, opened_by_uuid, closed_by_uuid FROM shifts');
    report.neonShiftsRaw = neonShifts.rows;

    // ── PART 7: Check User FK references ──────────────────────────────────────
    const userMappings = await prisma.localToCloudMapping.findMany({ where: { entityType: 'User' } });
    for (const um of userMappings) {
      const neonUser = await neon.query('SELECT id FROM users WHERE id = $1', [um.cloudUuid]);
      report.userCheck.push({
        localUserId: um.localId,
        cloudUuid: um.cloudUuid,
        neonExists: neonUser.rows.length > 0
      });
    }

    // ── PART 10: Generic mapping check across all entity types ─────────────────
    const NEON_TABLE_MAP: Record<string, string> = {
      User: 'users', Supplier: 'suppliers', Customer: 'customers',
      DailyRate: 'daily_rates', InventoryProduct: 'inventory_products',
      MilkProductDailyStock: 'milk_product_daily_stocks',
      Shift: 'shifts', Sale: 'sales', SaleItem: 'sale_items',
      Payment: 'payments', SupplierCollection: 'supplier_collections',
      SupplierPayment: 'supplier_payments', Expense: 'expenses',
      ExpensePayment: 'expense_payments', Return: 'returns',
      ReturnItem: 'return_items', InventoryMovement: 'inventory_movements',
      MilkProductTransaction: 'milk_product_transactions',
      ButterGheeConversion: 'butter_ghee_conversions',
      CashPerson: 'cash_persons', CashbookTransaction: 'cashbook_transactions'
    };

    const allMappings = await prisma.localToCloudMapping.findMany();
    for (const m of allMappings) {
      const neonTable = NEON_TABLE_MAP[m.entityType];
      if (!neonTable) continue;
      const neonRes = await neon.query(`SELECT id FROM ${neonTable} WHERE id = $1`, [m.cloudUuid]);
      if (neonRes.rows.length === 0) {
        const qe = await prisma.syncQueue.findFirst({
          where: { entityType: m.entityType, localId: m.localId },
          orderBy: { updatedAt: 'desc' }
        });
        report.genericMappingCheck.broken.push({
          entityType: m.entityType,
          localId: m.localId,
          cloudUuid: m.cloudUuid,
          neonExists: false,
          latestQueueStatus: qe?.status || 'NO_QUEUE_EVENT'
        });
      }
    }

    // ── Sample successful entity for comparison ────────────────────────────────
    const sampleSale = await prisma.sale.findFirst({ orderBy: { id: 'asc' } });
    if (sampleSale) {
      const saleMap = await prisma.localToCloudMapping.findFirst({ where: { entityType: 'Sale', localId: sampleSale.id } });
      const saleQe = await prisma.syncQueue.findFirst({ where: { entityType: 'Sale', localId: sampleSale.id, operation: 'CREATE' } });
      const neonSale = saleMap ? await neon.query('SELECT id, device_id, local_id FROM sales WHERE id = $1', [saleMap.cloudUuid]) : null;
      report.syncedSampleEntities.sale = {
        localId: sampleSale.id, cloudUuid: saleMap?.cloudUuid,
        queueStatus: saleQe?.status, payloadSnippet: saleQe ? JSON.parse(saleQe.payload) : null,
        neonRow: neonSale?.rows[0] || null
      };
    }

    console.log(JSON.stringify(report, null, 2));

  } catch (e: any) {
    console.error('Investigation failed:', e.message, e.stack);
  } finally {
    neon.release();
    await pool.end();
    await prisma.$disconnect();
  }
}
run();
