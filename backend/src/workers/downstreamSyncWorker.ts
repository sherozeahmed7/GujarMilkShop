import { prisma } from '../config/database';
import axios from 'axios';

const DOWNSTREAM_SYNC_ENABLED = process.env.DOWNSTREAM_SYNC_ENABLED === 'true';
const DOWNSTREAM_SYNC_INTERVAL_MS = parseInt(process.env.DOWNSTREAM_SYNC_INTERVAL_MS || '15000', 10);
const DOWNSTREAM_SYNC_BATCH_SIZE = parseInt(process.env.DOWNSTREAM_SYNC_BATCH_SIZE || '100', 10);
const SYNC_INTERNAL_SECRET = process.env.SYNC_INTERNAL_SECRET || '';
const API_BASE_URL = process.env.SYNC_API_URL
  ? process.env.SYNC_API_URL.replace('/batch', '')
  : 'http://localhost:5000/api/sync';

// --- Camel to snake_case helpers ---
function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

/** Parse a snake_case key'd payload object into camelCase keys */
function snakeToCamel(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[toCamel(k)] = v;
  }
  return out;
}

// -----------------------------------------------------------------------
// Entity-specific applicators
// Each function receives the cloud payload (snake_case JSON from Neon)
// and must find / create the local SQLite record inside a transaction.
// Foreign key UUID references are resolved via LocalToCloudMapping.
// -----------------------------------------------------------------------

async function resolveLocalId(
  tx: any,
  entityType: string,
  cloudUuid: string,
  sourceDeviceId: string,
  payloadContext?: any
): Promise<number | null> {
  const localDeviceId = process.env.DEVICE_ID || require('../utils/deviceId').getDeviceId();

  // 1. Direct business table embedded cloudUuid resolution (Phase 6 target)
  try {
    const rows: any[] = await tx.$queryRawUnsafe(
      `SELECT "id" FROM "${entityType}" WHERE "cloudUuid" = ?`,
      cloudUuid
    );
    if (rows.length > 0 && rows[0]?.id != null) {
      return Number(rows[0].id);
    }
  } catch (_) {}

  // 2. Compatibility fallback to LocalToCloudMapping if table exists
  try {
    const ownMapping = await tx.localToCloudMapping?.findFirst?.({
      where: { entityType, cloudUuid }
    });
    if (ownMapping) return ownMapping.localId;
  } catch (_) {}

  // 2. Safe mapping healing specifically for InventoryProduct
  if (entityType === 'InventoryProduct') {
    const p = payloadContext ? snakeToCamel(payloadContext) : {};

    // 2a. Resolve using validated device_id + local_id if available
    if (sourceDeviceId && p.localId) {
      const srcMapping = await tx.localToCloudMapping.findFirst({
        where: {
          entityType: 'InventoryProduct',
          deviceId: sourceDeviceId,
          localId: Number(p.localId)
        }
      });
      if (srcMapping) {
        return srcMapping.localId;
      }
    }

    // 2b. Use InventoryProduct code ONLY when safely verified
    let code = p.productCode || p.code;

    // If code is not in payload, fetch the product from Neon to get its code
    if (!code && cloudUuid) {
      try {
        const { getNeonPool } = require('../config/neonDb');
        const neonPool = getNeonPool();
        const neonProdRes = await neonPool.query('SELECT code FROM inventory_products WHERE id = $1', [cloudUuid]);
        if (neonProdRes.rowCount && neonProdRes.rowCount > 0 && neonProdRes.rows[0].code) {
          code = neonProdRes.rows[0].code;
        }
      } catch (e: any) {
        console.warn(`[Downstream] Could not query Neon for InventoryProduct ${cloudUuid}:`, e.message);
      }
    }

    if (code && typeof code === 'string' && code.trim()) {
      const trimmedCode = code.trim();
      const matchingProducts = await tx.inventoryProduct.findMany({
        where: { code: trimmedCode }
      });

      // Must have exactly ONE local InventoryProduct matching
      if (matchingProducts.length === 1) {
        const candidate = matchingProducts[0];

        // Check if there is a conflicting existing mapping for this candidate to a different cloud UUID
        const existingMapping = await tx.localToCloudMapping.findFirst({
          where: {
            entityType: 'InventoryProduct',
            localId: candidate.id
          }
        });

        // Safe to heal/create mapping if:
        // 1. No mapping exists, OR
        // 2. Existing mapping points to the same cloudUuid, OR
        // 3. Existing mapping points to a stale UUID that does NOT exist in Neon while candidate is a unique locked/singleton product with matching code
        let isSafeToHeal = !existingMapping || existingMapping.cloudUuid === cloudUuid;

        if (!isSafeToHeal && existingMapping && candidate.isLocked) {
          try {
            const { getNeonPool } = require('../config/neonDb');
            const neonPool = getNeonPool();
            const staleCheck = await neonPool.query('SELECT id FROM inventory_products WHERE id = $1', [existingMapping.cloudUuid]);
            if (staleCheck.rowCount === 0) {
              // Existing mapping points to a non-existent/stale UUID. The incoming cloudUuid is authoritative.
              isSafeToHeal = true;
              console.log(`[Downstream] Existing mapping for ${trimmedCode} (${existingMapping.cloudUuid}) is stale/dead in Neon. Reconciling to authoritative cloud UUID ${cloudUuid}`);
            }
          } catch (e: any) {
            console.warn(`[Downstream] Could not verify stale mapping for ${trimmedCode}:`, e.message);
          }
        }

        if (isSafeToHeal) {
          await ensureMapping(tx, 'InventoryProduct', candidate.id, cloudUuid, localDeviceId);
          console.log(`[Downstream] Healed InventoryProduct mapping: local ID ${candidate.id} (${trimmedCode}) -> cloud UUID ${cloudUuid}`);
          return candidate.id;
        } else {
          console.warn(`[Downstream] Cannot heal InventoryProduct mapping for code ${trimmedCode}: local ID ${candidate.id} already mapped to ${existingMapping.cloudUuid}`);
        }
      } else if (matchingProducts.length > 1) {
        console.warn(`[Downstream] Ambiguous InventoryProduct match for code ${trimmedCode}: found ${matchingProducts.length} candidates`);
      }
    }
  }

  return null;
}

async function resolveIdentityForReconciliation(
  tx: any,
  entityType: string,
  cloudUuid: string,
  payload: any,
  sourceDeviceId?: string
): Promise<number | null> {
  const localDeviceId = process.env.DEVICE_ID || require('../utils/deviceId').getDeviceId();

  // 1. Try UUID mapping
  const ownMapping = await tx.localToCloudMapping.findFirst({
    where: { entityType, cloudUuid }
  });
  if (ownMapping) return ownMapping.localId;

  // 2. Strict entity-specific reconciliation
  const p = snakeToCamel(payload || {});

  if (entityType === 'Customer' && p.customerType === 'walk_in') {
    const customer = await tx.customer.findFirst({
      where: { customerType: 'walk_in' },
      orderBy: { id: 'asc' },
    });
    if (customer) return customer.id;
  }

  // Shift: Do NOT match by shiftDate alone, as multiple shifts can occur on the same date.
  // Shifts are identified strictly by (deviceId, localId) mapping or cloud UUID.
  if (entityType === 'Shift') {
    return null;
  }

  // InventoryProduct: Match by unique code if exactly one exists
  if (entityType === 'InventoryProduct' && p.code) {
    const matching = await tx.inventoryProduct.findMany({ where: { code: p.code } });
    if (matching.length === 1) return matching[0].id;
  }

  // MilkProductDailyStock: Unique date-based record per calendar day
  if (entityType === 'MilkProductDailyStock' && p.date) {
     const dateValue = new Date(p.date);
     dateValue.setHours(0,0,0,0);
     const stock = await tx.milkProductDailyStock.findFirst({ where: { date: dateValue } });
     if (stock) return stock.id;
  }

  return null;
}

async function ensureMapping(
  tx: any,
  entityType: string,
  localId: number,
  cloudUuid: string,
  deviceId: string
): Promise<void> {
  // 1. Direct embedded cloudUuid update on business table
  try {
    await tx.$executeRawUnsafe(
      `UPDATE "${entityType}" SET "cloudUuid" = ? WHERE "id" = ? AND ("cloudUuid" IS NULL OR "cloudUuid" = '')`,
      cloudUuid,
      localId
    );
  } catch (_) {}

  // 2. Compatibility update on localToCloudMapping if model exists
  try {
    if (tx.localToCloudMapping?.upsert) {
      await tx.localToCloudMapping.upsert({
        where: {
          deviceId_entityType_localId: {
            deviceId,
            entityType,
            localId
          }
        },
        update: { cloudUuid },
        create: { deviceId, entityType, localId, cloudUuid }
      });
    }
  } catch (_) {}
}

// -----------------------------------------------------------------------
// SAFETY CLASSIFICATIONS
// -----------------------------------------------------------------------
const MASTER_DATA_ENTITIES = new Set([
  'Customer', 'Supplier', 'InventoryProduct', 'User', 'DailyRate'
]);

// Transactions: CREATEs are applied; UPDATEs are only applied if safe; DELETEs are SKIPPED
const TRANSACTION_ENTITIES = new Set([
  'Sale', 'SaleItem', 'Payment',
  'SupplierCollection', 'SupplierPayment',
  'InventoryMovement',
  'Expense', 'ExpensePayment',
  'Return', 'ReturnItem',
  'ButterGheeConversion',
  'Shift'
]);

// Held carts are device-local drafts and are intentionally not replicated.
const SKIP_ENTITIES = new Set([
  'HeldCart'
]);

// -----------------------------------------------------------------------
// APPLICATORS
// -----------------------------------------------------------------------

async function applyChange(
  tx: any,
  change: {
    changeSequence: string;
    eventUuid: string;
    deviceId: string;
    entityType: string;
    cloudUuid: string;
    operation: string;
    payload: Record<string, any>;
  }
): Promise<{ status: 'APPLIED' | 'SKIPPED'; reason?: string }> {

  const { entityType, cloudUuid, operation, payload, deviceId } = change;
  const localDeviceId = process.env.DEVICE_ID || require('../utils/deviceId').getDeviceId();

  // --- Skip derived/audit entities ---
  if (SKIP_ENTITIES.has(entityType)) {
    return { status: 'SKIPPED', reason: `${entityType} is not synced downstream` };
  }

  // --- DELETE: protect all financial transactions ---
  if (operation === 'DELETE') {
    if (TRANSACTION_ENTITIES.has(entityType)) {
      return {
        status: 'SKIPPED',
        reason: `Downstream DELETE for ${entityType} is protected — financial history preserved`
      };
    }
    // Master data delete: resolve local ID and soft-delete or delete
    const localId = await resolveLocalId(tx, entityType, cloudUuid, deviceId);
    if (!localId) {
      return { status: 'SKIPPED', reason: `No local mapping for ${entityType} ${cloudUuid}` };
    }
    await applyMasterDelete(tx, entityType, localId);
    return { status: 'APPLIED' };
  }

  // --- UPDATE: master data only, conflict resolution applied ---
  if (operation === 'UPDATE') {
    const localId = await resolveLocalId(tx, entityType, cloudUuid, deviceId);
    if (!localId) {
      return { status: 'SKIPPED', reason: `No local mapping for UPDATE on ${entityType} ${cloudUuid}` };
    }
    await applyUpdate(tx, entityType, localId, cloudUuid, payload, deviceId);
    return { status: 'APPLIED' };
  }

  // --- CREATE / UPSERT: apply new records from other devices ---
  if (operation === 'CREATE' || operation === 'UPSERT') {
    // F2 daily stock: upsert by local date even when already mapped
    if (entityType === 'MilkProductDailyStock' && operation === 'UPSERT') {
      await applyMilkProductDailyStockUpsert(tx, cloudUuid, payload, deviceId, localDeviceId);
      return { status: 'APPLIED' };
    }

    const resolvedLocalId = await resolveIdentityForReconciliation(tx, entityType, cloudUuid, payload);
    if (resolvedLocalId) {
      // Degrade to UPDATE to prevent UNIQUE constraint errors locally and reconcile state
      await applyUpdate(tx, entityType, resolvedLocalId, cloudUuid, payload, deviceId);
      await ensureMapping(tx, entityType, resolvedLocalId, cloudUuid, localDeviceId);
      return { status: 'APPLIED' };
    }

    await applyCreate(tx, entityType, cloudUuid, payload, deviceId, localDeviceId);
    return { status: 'APPLIED' };
  }

  return { status: 'SKIPPED', reason: `Unknown operation: ${operation}` };
}

export {
  resolveLocalId,
  resolveIdentityForReconciliation,
  ensureMapping,
  applyChange,
  applyCreate,
  applyUpdate,
  applyMasterDelete,
  applyMilkProductDailyStockUpsert
};

// -----------------------------------------------------------------------
// -----------------------------------------------------------------------
async function applyMilkProductDailyStockUpsert(
  tx: any,
  cloudUuid: string,
  payload: Record<string, any>,
  sourceDeviceId: string,
  localDeviceId: string
): Promise<void> {
  const p = snakeToCamel(payload);
  const dateValue = p.date ? new Date(p.date) : new Date();
  dateValue.setHours(0, 0, 0, 0);

  const data = {
    milkTotal: Number(p.milkTotal ?? 0),
    lassiProduced: Number(p.lassiProduced ?? 0),
    lassiSold: Number(p.lassiSold ?? 0),
    lassiRemaining: Number(p.lassiRemaining ?? 0),
    butterOpening: Number(p.butterOpening ?? 0),
    butterProduced: Number(p.butterProduced ?? 0),
    butterSold: Number(p.butterSold ?? 0),
    butterConverted: Number(p.butterConverted ?? 0),
    butterClosing: Number(p.butterClosing ?? 0),
    gheeOpening: Number(p.gheeOpening ?? 0),
    gheeProduced: Number(p.gheeProduced ?? 0),
    gheeSold: Number(p.gheeSold ?? 0),
    gheeClosing: Number(p.gheeClosing ?? 0),
  };

  const existing = await tx.milkProductDailyStock.findFirst({ where: { date: dateValue } });
  let rec;
  if (existing) {
    rec = await tx.milkProductDailyStock.update({ where: { id: existing.id }, data });
  } else {
    rec = await tx.milkProductDailyStock.create({ data: { date: dateValue, ...data } });
  }
  await ensureMapping(tx, 'MilkProductDailyStock', rec.id, cloudUuid, localDeviceId);
}

async function applyCreate(
  tx: any,
  entityType: string,
  cloudUuid: string,
  payload: Record<string, any>,
  sourceDeviceId: string,
  localDeviceId: string
): Promise<void> {
  const p = snakeToCamel(payload);

  switch (entityType) {
    case 'Customer': {
      const rec = await tx.customer.create({
        data: {
          name: p.name,
          phone: p.phone ?? null,
          address: p.address ?? null,
          customerType: p.customerType ?? 'retail',
          status: p.status ?? 'active',
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'Customer', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'Supplier': {
      const existingByCode = p.code
        ? await tx.supplier.findFirst({ where: { code: p.code } })
        : null;
      if (existingByCode) {
        await ensureMapping(tx, 'Supplier', existingByCode.id, cloudUuid, localDeviceId);
        break;
      }
      const rec = await tx.supplier.create({
        data: {
          name: p.name,
          code: p.code,
          phone: p.phone ?? null,
          defaultRate: Number(p.defaultRate ?? 0),
          cowRate: Number(p.cowRate ?? 0),
          buffaloRate: Number(p.buffaloRate ?? 0),
          cycleType: p.cycleType ?? 'Monthly Cycle',
          isActive: p.isActive ?? true,
          guaranteedAdvance: Number(p.guaranteedAdvance ?? 0),
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'Supplier', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'InventoryProduct': {
      const existingByCode = p.code
        ? await tx.inventoryProduct.findFirst({ where: { code: p.code } })
        : null;
      if (existingByCode) {
        await ensureMapping(tx, 'InventoryProduct', existingByCode.id, cloudUuid, localDeviceId);
        break;
      }
      const rec = await tx.inventoryProduct.create({
        data: {
          code: p.code,
          name: p.name,
          description: p.description ?? null,
          category: p.category ?? 'Dairy',
          unit: p.unit ?? 'kg',
          tax: p.tax ?? 'Exempt',
          lowStockThreshold: Number(p.lowStockThreshold ?? 0),
          isActive: p.isActive ?? true,
          isLocked: p.isLocked ?? false,
        }
      });
      await ensureMapping(tx, 'InventoryProduct', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'MilkProductDailyStock': {
      await applyMilkProductDailyStockUpsert(tx, cloudUuid, payload, sourceDeviceId, localDeviceId);
      break;
    }
    case 'DailyRate': {
      const rec = await tx.dailyRate.create({
        data: {
          milkRate: Number(p.milkRate),
          yogurtRate: Number(p.yogurtRate),
          lassiRate: Number(p.lassiRate ?? 0),
          butterRate: Number(p.butterRate ?? 0),
          gheeRate: Number(p.gheeRate ?? 0),
          updatedByRole: p.updatedByRole ?? 'unknown',
          date: p.date ? new Date(p.date) : new Date(),
        }
      });
      await ensureMapping(tx, 'DailyRate', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'User': {
      // Handle assignedScreens when incoming as array from Postgres or string from SQLite
      const screensValue = typeof p.assignedScreens === 'string'
        ? p.assignedScreens
        : JSON.stringify(p.assignedScreens ?? p.assigned_screens ?? []);

      const existingByEmail = p.email
        ? await tx.user.findUnique({ where: { email: p.email } })
        : null;

      if (existingByEmail) {
        await tx.user.update({
          where: { id: existingByEmail.id },
          data: {
            name: p.name ?? existingByEmail.name,
            role: p.role ?? existingByEmail.role,
            status: p.status ?? existingByEmail.status,
            assignedScreens: screensValue,
          }
        });
        await ensureMapping(tx, 'User', existingByEmail.id, cloudUuid, localDeviceId);
        break;
      }

      // Only non-sensitive fields; password hash comes from auth flow, not sync
      const rec = await tx.user.create({
        data: {
          name: p.name ?? null,
          email: p.email,
          password: p.password, // hash only, never plaintext
          role: p.role ?? 'user',
          status: p.status ?? 'active',
          assignedScreens: screensValue,
        }
      });
      await ensureMapping(tx, 'User', rec.id, cloudUuid, localDeviceId);
      break;
    }
    // --- Transaction entities (CREATE only, no downstream DELETE/UPDATE for financial safety) ---
    case 'Sale': {
      // Resolve customer UUID → local customer ID
      let customerId: number | null = null;
      if (p.customerUuid) {
        customerId = await resolveLocalId(tx, 'Customer', p.customerUuid, sourceDeviceId);
      }
      const rec = await tx.sale.create({
        data: {
          saleType: p.saleType,
          customerId: customerId,
          customerName: p.customerName ?? null,
          customerPhone: p.customerPhone ?? null,
          totalAmount: Number(p.totalAmount),
          paidAmount: Number(p.paidAmount ?? 0),
          remainingBalance: Number(p.remainingBalance ?? 0),
          status: p.status ?? 'paid',
          tokenNumber: Number(p.tokenNumber ?? 0),
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'Sale', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'SaleItem': {
      const saleLocalId = p.saleUuid
        ? await resolveLocalId(tx, 'Sale', p.saleUuid, sourceDeviceId)
        : null;
      if (!saleLocalId) throw new Error(`Cannot apply SaleItem: missing Sale mapping for ${p.saleUuid}`);
      const rec = await tx.saleItem.create({
        data: {
          saleId: saleLocalId,
          itemName: p.itemName,
          quantity: Number(p.quantity),
          unitPrice: Number(p.unitPrice),
          totalPrice: Number(p.totalPrice),
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'SaleItem', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'Payment': {
      const saleLocalId = p.saleUuid
        ? await resolveLocalId(tx, 'Sale', p.saleUuid, sourceDeviceId)
        : null;
      if (!saleLocalId) throw new Error(`Cannot apply Payment: missing Sale mapping for ${p.saleUuid}`);
      const rec = await tx.payment.create({
        data: {
          saleId: saleLocalId,
          method: p.method ?? 'cash',
          amount: Number(p.amount),
          status: p.status ?? 'completed',
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'Payment', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'SupplierCollection': {
      const supplierLocalId = p.supplierUuid
        ? await resolveLocalId(tx, 'Supplier', p.supplierUuid, sourceDeviceId)
        : null;
      if (!supplierLocalId) throw new Error(`Cannot apply SupplierCollection: missing Supplier mapping`);

      if (p.date && p.shift) {
        const existingColl = await tx.supplierCollection.findUnique({
          where: {
            supplierId_date_shift: {
              supplierId: supplierLocalId,
              date: p.date,
              shift: p.shift,
            }
          }
        });
        if (existingColl) {
          await ensureMapping(tx, 'SupplierCollection', existingColl.id, cloudUuid, localDeviceId);
          break;
        }
      }

      const rec = await tx.supplierCollection.create({
        data: {
          supplierId: supplierLocalId,
          date: p.date,
          shift: p.shift,
          milkType: p.milkType,
          quantity: Number(p.quantity),
          rate: Number(p.rate),
          amount: Number(p.amount),
          notes: p.notes ?? null,
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'SupplierCollection', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'SupplierPayment': {
      const supplierLocalId = p.supplierUuid
        ? await resolveLocalId(tx, 'Supplier', p.supplierUuid, sourceDeviceId)
        : null;
      if (!supplierLocalId) throw new Error(`Cannot apply SupplierPayment: missing Supplier mapping`);
      const shiftLocalId = p.shiftUuid
        ? await resolveLocalId(tx, 'Shift', p.shiftUuid, sourceDeviceId)
        : null;
      const rec = await tx.supplierPayment.create({
        data: {
          supplierId: supplierLocalId,
          shiftId: shiftLocalId,
          date: p.date,
          amount: Number(p.amount),
          method: p.method ?? 'cash',
          notes: p.notes ?? null,
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'SupplierPayment', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'Expense': {
      const rec = await tx.expense.create({
        data: {
          date: p.date,
          category: p.category,
          description: p.description ?? null,
          quantity: Number(p.quantity ?? 0),
          unitCost: Number(p.unitCost ?? 0),
          grossLoss: Number(p.grossLoss ?? 0),
          soldRecovery: Number(p.soldRecovery ?? 0),
          netExpense: Number(p.netExpense ?? 0),
          amount: Number(p.amount ?? 0),
          paidAmount: Number(p.paidAmount ?? 0),
          remaining: Number(p.remaining ?? 0),
          reason: p.reason ?? null,
          addedBy: p.addedBy ?? 'sync',
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'Expense', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'ExpensePayment': {
      const expenseLocalId = p.expenseUuid
        ? await resolveLocalId(tx, 'Expense', p.expenseUuid, sourceDeviceId)
        : null;
      if (!expenseLocalId) throw new Error(`Cannot apply ExpensePayment: missing Expense mapping`);
      const shiftLocalId = p.shiftUuid
        ? await resolveLocalId(tx, 'Shift', p.shiftUuid, sourceDeviceId)
        : null;
      const rec = await tx.expensePayment.create({
        data: {
          expenseId: expenseLocalId,
          amount: Number(p.amount),
          shiftId: shiftLocalId,
          date: p.date,
          addedBy: p.addedBy ?? 'sync',
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'ExpensePayment', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'InventoryMovement': {
      const productLocalId = p.productUuid
        ? await resolveLocalId(tx, 'InventoryProduct', p.productUuid, sourceDeviceId, p)
        : null;
      if (!productLocalId) throw new Error(`Cannot apply InventoryMovement: missing InventoryProduct mapping`);
      const supplierLocalId = p.supplierUuid
        ? await resolveLocalId(tx, 'Supplier', p.supplierUuid, sourceDeviceId, p)
        : null;
      const shiftLocalId = p.shiftUuid
        ? await resolveLocalId(tx, 'Shift', p.shiftUuid, sourceDeviceId, p)
        : null;

      if (p.reference) {
        const existingByRef = await tx.inventoryMovement.findUnique({
          where: { reference: p.reference }
        });
        if (existingByRef) {
          await ensureMapping(tx, 'InventoryMovement', existingByRef.id, cloudUuid, localDeviceId);
          break;
        }
      }

      const rec = await tx.inventoryMovement.create({
        data: {
          productId: productLocalId,
          quantity: Number(p.quantity),
          movementType: p.movementType,
          source: p.source,
          reference: p.reference,
          unitCost: p.unitCost != null ? Number(p.unitCost) : null,
          supplierId: supplierLocalId,
          shiftId: shiftLocalId,
          date: p.date ? new Date(p.date) : new Date(),
        }
      });
      await ensureMapping(tx, 'InventoryMovement', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'ButterGheeConversion': {
      const rec = await tx.butterGheeConversion.create({
        data: {
          date: p.date ? new Date(p.date) : new Date(),
          butterUsed: Number(p.butterUsed),
          gheeProduced: Number(p.gheeProduced),
          notes: p.notes ?? null,
        }
      });
      await ensureMapping(tx, 'ButterGheeConversion', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'Return': {
      const saleLocalId = p.saleUuid
        ? await resolveLocalId(tx, 'Sale', p.saleUuid, sourceDeviceId)
        : null;
      const rec = await tx.return.create({
        data: {
          saleId: saleLocalId,
          billNumber: p.billNumber,
          date: p.date,
          customer: p.customer,
          returnType: p.returnType,
          refundAmount: Number(p.refundAmount),
          paymentMethod: p.paymentMethod,
          reason: p.reason,
          status: p.status ?? 'Completed',
          processedBy: p.processedBy ?? 'sync',
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'Return', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'ReturnItem': {
      const returnLocalId = p.returnUuid
        ? await resolveLocalId(tx, 'Return', p.returnUuid, sourceDeviceId)
        : null;
      if (!returnLocalId) throw new Error(`Cannot apply ReturnItem: missing Return mapping`);
      const rec = await tx.returnItem.create({
        data: {
          returnId: returnLocalId,
          itemId: p.itemId,
          name: p.name,
          returnQty: Number(p.returnQty),
          unitPrice: Number(p.unitPrice),
          refundAmount: Number(p.refundAmount),
        }
      });
      await ensureMapping(tx, 'ReturnItem', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'AuditRecord': {
      const asJsonString = (value: unknown) => typeof value === 'string' ? value : JSON.stringify(value ?? []);
      const rec = await tx.auditRecord.create({
        data: {
          auditDate: p.auditDate,
          executedAt: p.executedAt ? new Date(p.executedAt) : new Date(),
          totalPosBills: Number(p.totalPosBills),
          collectedReceipts: Number(p.collectedReceipts),
          matched: asJsonString(p.matched),
          missing: asJsonString(p.missing),
          extra: asJsonString(p.extra),
          duplicates: asJsonString(p.duplicates),
          status: p.status,
          notes: p.notes ?? '',
          auditedBy: p.auditedBy,
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'AuditRecord', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'CashPerson': {
      const rec = await tx.cashPerson.create({
        data: {
          name: p.name,
          phone: p.phone ?? null,
          address: p.address ?? null,
          type: p.type,
          description: p.description ?? null,
          openingBalance: Number(p.openingBalance ?? 0),
          customerType: p.customerType,
          status: p.status ?? 'Active',
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'CashPerson', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'CashbookTransaction': {
      const cashPersonLocalId = p.cashPersonUuid
        ? await resolveLocalId(tx, 'CashPerson', p.cashPersonUuid, sourceDeviceId)
        : null;
      if (!cashPersonLocalId) throw new Error('Cannot apply CashbookTransaction: missing CashPerson mapping');
      const rec = await tx.cashbookTransaction.create({
        data: {
          cashPersonId: cashPersonLocalId,
          cashPersonName: p.cashPersonName,
          transactionType: p.transactionType,
          amount: Number(p.amount),
          description: p.description ?? null,
          date: p.date,
          createdBy: p.createdBy ?? 'Admin',
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'CashbookTransaction', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'ActivityLog': {
      const rec = await tx.activityLog.create({
        data: {
          timestamp: p.timestamp ? new Date(p.timestamp) : new Date(),
          user: p.user,
          userRole: p.userRole,
          action: p.action,
          module: p.module,
          description: p.description,
          entityId: p.entityId ?? null,
          ip: p.ip ?? null,
          status: p.status,
          createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
        }
      });
      await ensureMapping(tx, 'ActivityLog', rec.id, cloudUuid, localDeviceId);
      break;
    }
    case 'Shift': {
      const openedByLocalId = p.openedByUuid
        ? await resolveLocalId(tx, 'User', p.openedByUuid, sourceDeviceId)
        : null;
      const rec = await tx.shift.create({
        data: {
          shiftDate: p.shiftDate,
          openedById: openedByLocalId ?? 1,
          closedById: null,
          openedAt: p.openedAt ? new Date(p.openedAt) : new Date(),
          closedAt: p.closedAt ? new Date(p.closedAt) : null,
          openingCash: Number(p.openingCash ?? 0),
          openingNotes: p.openingNotes ?? null,
          expectedCash: Number(p.expectedCash ?? 0),
          countedCash: p.countedCash != null ? Number(p.countedCash) : null,
          difference: p.difference != null ? Number(p.difference) : null,
          differenceStatus: p.differenceStatus ?? null,
          closingNotes: p.closingNotes ?? null,
          status: p.status ?? 'Closed',
        }
      });
      await ensureMapping(tx, 'Shift', rec.id, cloudUuid, localDeviceId);
      break;
    }
    default:
      throw new Error(`No CREATE applicator for entityType: ${entityType}`);
  }
}

// -----------------------------------------------------------------------
async function applyUpdate(
  tx: any,
  entityType: string,
  localId: number,
  cloudUuid: string,
  payload: Record<string, any>,
  sourceDeviceId: string
): Promise<void> {
  const p = snakeToCamel(payload);

  try {
    switch (entityType) {
      case 'Customer':
        await tx.customer.update({
          where: { id: localId },
          data: {
            name: p.name,
            phone: p.phone ?? null,
            address: p.address ?? null,
            customerType: p.customerType,
            status: p.status ?? 'active',
          }
        });
        break;
      case 'Supplier':
        await tx.supplier.update({
          where: { id: localId },
          data: {
            name: p.name,
            phone: p.phone ?? null,
            defaultRate: Number(p.defaultRate ?? 0),
            cowRate: Number(p.cowRate ?? 0),
            buffaloRate: Number(p.buffaloRate ?? 0),
            cycleType: p.cycleType ?? 'Monthly Cycle',
            isActive: p.isActive ?? true,
            guaranteedAdvance: Number(p.guaranteedAdvance ?? 0),
          }
        });
        break;
      case 'InventoryProduct':
        await tx.inventoryProduct.update({
          where: { id: localId },
          data: {
            name: p.name,
            description: p.description ?? null,
            category: p.category ?? 'Dairy',
            unit: p.unit ?? 'kg',
            tax: p.tax ?? 'Exempt',
            lowStockThreshold: Number(p.lowStockThreshold ?? 0),
            isActive: p.isActive ?? true,
            isLocked: p.isLocked ?? false,
          }
        });
        break;
      case 'User': {
        const screensValue = typeof p.assignedScreens === 'string'
          ? p.assignedScreens
          : JSON.stringify(p.assignedScreens ?? p.assigned_screens ?? []);

        await tx.user.update({
          where: { id: localId },
          data: {
            name: p.name ?? null,
            role: p.role ?? 'user',
            status: p.status ?? 'active',
            assignedScreens: screensValue,
          }
        });
        break;
      }
      case 'CashPerson':
        await tx.cashPerson.update({
          where: { id: localId },
          data: {
            name: p.name,
            phone: p.phone ?? null,
            address: p.address ?? null,
            type: p.type,
            description: p.description ?? null,
            openingBalance: Number(p.openingBalance ?? 0),
            customerType: p.customerType,
            status: p.status ?? 'Active',
          }
        });
        break;
      // Transactions: UPDATE is allowed for status changes only (e.g. Sale paid off)
      case 'Sale':
        await tx.sale.update({
          where: { id: localId },
          data: {
            paidAmount: Number(p.paidAmount ?? 0),
            remainingBalance: Number(p.remainingBalance ?? 0),
            status: p.status,
            tokenNumber: p.tokenNumber != null ? Number(p.tokenNumber) : undefined,
          }
        });
        break;
      case 'Payment':
        await tx.payment.update({
          where: { id: localId },
          data: {
            method: p.method ?? 'cash',
            amount: Number(p.amount ?? 0),
            status: p.status ?? 'completed',
          }
        });
        break;
      case 'SupplierCollection':
        await tx.supplierCollection.update({
          where: { id: localId },
          data: {
            date: p.date,
            shift: p.shift,
            milkType: p.milkType,
            quantity: Number(p.quantity ?? 0),
            rate: Number(p.rate ?? 0),
            amount: Number(p.amount ?? 0),
            notes: p.notes ?? null,
          }
        });
        break;
      case 'Expense':
        await tx.expense.update({
          where: { id: localId },
          data: {
            paidAmount: Number(p.paidAmount ?? 0),
            remaining: Number(p.remaining ?? 0),
            ...(p.amount !== undefined ? { amount: Number(p.amount) } : {}),
          }
        });
        break;
      case 'Shift':
        await tx.shift.update({
          where: { id: localId },
          data: {
            openedAt: p.openedAt ? new Date(p.openedAt) : undefined,
            closedAt: p.closedAt ? new Date(p.closedAt) : undefined,
            openingCash: p.openingCash != null ? Number(p.openingCash) : undefined,
            expectedCash: p.expectedCash != null ? Number(p.expectedCash) : undefined,
            countedCash: p.countedCash != null ? Number(p.countedCash) : undefined,
            difference: p.difference != null ? Number(p.difference) : undefined,
            differenceStatus: p.differenceStatus,
            openingNotes: p.openingNotes,
            closingNotes: p.closingNotes,
            status: p.status,
          }
        });
        break;
      default:
        console.warn(`[Downstream] No UPDATE applicator for ${entityType} — skipped`);
    }
  } catch (err: any) {
    if (err?.code === 'P2025' || err?.message?.includes('Record to update not found') || err?.message?.includes('No record was found for an update')) {
      console.warn(`[Downstream] ⚠️ ${entityType} #${localId} (cloud UUID: ${cloudUuid}) not found in SQLite for update. Recreating via applyCreate...`);
      await applyCreate(tx, entityType, cloudUuid, payload, sourceDeviceId, sourceDeviceId);
      return;
    }
    throw err;
  }
}

// -----------------------------------------------------------------------
async function applyMasterDelete(tx: any, entityType: string, localId: number): Promise<void> {
  try {
    switch (entityType) {
      case 'Customer':
        await tx.customer.update({ where: { id: localId }, data: { status: 'inactive' } });
        break;
      case 'Supplier':
        await tx.supplier.update({ where: { id: localId }, data: { isActive: false } });
        break;
      case 'InventoryProduct':
        await tx.inventoryProduct.update({ where: { id: localId }, data: { isActive: false } });
        break;
      case 'User':
        await tx.user.update({ where: { id: localId }, data: { status: 'inactive' } });
        break;
      default:
        console.warn(`[Downstream] No DELETE applicator for ${entityType} — skipped`);
    }
  } catch (err: any) {
    if (err?.code === 'P2025' || err?.message?.includes('Record to update not found') || err?.message?.includes('No record was found for an update')) {
      console.warn(`[Downstream] ⚠️ ${entityType} #${localId} not found in SQLite for delete/deactivate — skipped`);
      return;
    }
    throw err;
  }
}

// -----------------------------------------------------------------------
// MAIN DOWNSTREAM SYNC PROCESSOR
// -----------------------------------------------------------------------

import { isRestoreInProgress } from '../utils/restoreLock';

let isDownstreamSyncing = false;

export async function processDownstreamSync(): Promise<void> {
  if (isDownstreamSyncing || isRestoreInProgress()) return;
  isDownstreamSyncing = true;

  try {
    // 0. Check local DB setting
    const localSettings = await prisma.cloudSyncSettings.findUnique({ where: { id: 1 } });
    if (localSettings && !localSettings.downstreamEnabled) {
      isDownstreamSyncing = false;
      return;
    }

    const deviceId = process.env.DEVICE_ID || require('../utils/deviceId').getDeviceId();

    // 1. Load or initialize cursor state
    let state = await prisma.downstreamSyncState.findUnique({ where: { id: 1 } });
    if (!state) {
      // First run: fetch current max cursor from cloud — skip historical baseline
      console.log('[Downstream] Initializing cursor from cloud...');
      const cursorRes = await axios.get(`${API_BASE_URL}/downstream/cursor`, {
        headers: { 'x-sync-secret': SYNC_INTERNAL_SECRET },
        timeout: 30000
      });
      const initialCursor = BigInt(cursorRes.data.cursor || '0');
      state = await prisma.downstreamSyncState.create({
        data: { id: 1, lastCursor: initialCursor }
      });
      console.log(`[Downstream] Initialized at cursor ${initialCursor}. No historical replay.`);
      return; // Exit — will process new changes on next cycle
    }

    const currentCursor = state.lastCursor;

    // 2. Fetch new changes from cloud
    const response = await axios.get(`${API_BASE_URL}/downstream`, {
      params: {
        deviceId,
        cursor: currentCursor.toString(),
        limit: DOWNSTREAM_SYNC_BATCH_SIZE
      },
      headers: { 'x-sync-secret': SYNC_INTERNAL_SECRET },
      timeout: 30000
    });

    const { changes, nextCursor, hasMore } = response.data;

    if (!changes || changes.length === 0) {
      // Nothing new — update last sync timestamp
      await prisma.downstreamSyncState.update({
        where: { id: 1 },
        data: { lastSuccessfulSync: new Date(), lastError: null }
      });
      return;
    }

    console.log(`[Downstream] Received ${changes.length} changes (cursor: ${currentCursor} → ${nextCursor})`);

    // 3. Apply changes ONE AT A TIME, atomically, cursor advances per change
    let lastAppliedCursor = currentCursor;

    for (const change of changes) {
      const seq = BigInt(change.changeSequence);

      // Check idempotency — skip if already applied
      const alreadyApplied = await prisma.downstreamAppliedEvent.findUnique({
        where: { changeSequence: seq }
      });
      if (alreadyApplied) {
        lastAppliedCursor = seq;
        continue;
      }

      // Apply change within a transaction — cursor advances only on success
      try {
        await prisma.$transaction(async (tx) => {
          // Apply the business change
          const result = await applyChange(tx, change);

          // Record as applied (idempotency guard)
          await tx.downstreamAppliedEvent.create({
            data: {
              changeSequence: seq,
              eventUuid: change.eventUuid,
              entityType: change.entityType,
              operation: change.operation,
            }
          });

          // Advance cursor WITHIN the transaction — atomic with change application
          await tx.downstreamSyncState.update({
            where: { id: 1 },
            data: { lastCursor: seq, lastSuccessfulSync: new Date(), lastError: null }
          });

          if (result.status === 'APPLIED') {
            console.log(`[Downstream] ✅ APPLIED ${change.entityType} ${change.operation} (seq: ${seq})`);
          } else {
            console.log(`[Downstream] ⏭ SKIPPED ${change.entityType} ${change.operation} — ${result.reason}`);
          }
        });

        lastAppliedCursor = seq;

      } catch (err: any) {
        console.error(`[Downstream] ❌ FAILED seq ${seq} (${change.entityType} ${change.operation}):`, err.message);
        // Record the error on the state but DO NOT advance cursor
        await prisma.downstreamSyncState.update({
          where: { id: 1 },
          data: { lastError: `seq:${seq} ${err.message}` }
        });
        // Stop processing this batch — will retry from this cursor next cycle
        break;
      }
    }

    if (hasMore) {
      console.log(`[Downstream] More changes available. Next cursor: ${nextCursor}`);
    }

  } catch (err: any) {
    console.error('[Downstream] Worker error:', err.message);
    
    let errorMsg = err.message;

    // Detect our custom 410 Gone / restoreRequired response
    if (err.response?.status === 410 && err.response?.data?.restoreRequired) {
      console.error('[Downstream] 🚨 SYNC_HISTORY_EXPIRED: The local cursor is too old and history was deleted.');
      console.error('[Downstream] 🚨 A full manual Restore is required.');
      errorMsg = 'RESTORE_REQUIRED: ' + (err.response.data.error || 'Sync history expired');
      // Turn off downstream sync locally so it stops hammering the server until fixed
      try {
        await prisma.cloudSyncSettings.update({
          where: { id: 1 },
          data: { downstreamEnabled: false }
        });
      } catch (e) { /* ignore */ }
    }

    // Network/API errors: record but don't advance cursor
    try {
      await prisma.downstreamSyncState.updateMany({
        where: { id: 1 },
        data: { lastError: errorMsg }
      });
    } catch { /* ignore secondary error */ }
  } finally {
    isDownstreamSyncing = false;
  }
}

// -----------------------------------------------------------------------
// STARTUP
// -----------------------------------------------------------------------
let downstreamInterval: NodeJS.Timeout | null = null;

export function startDownstreamSyncWorker(): void {
  if (!DOWNSTREAM_SYNC_ENABLED) {
    console.log('[Downstream] Worker disabled (DOWNSTREAM_SYNC_ENABLED=false).');
    return;
  }
  if (downstreamInterval) {
    console.log('[Downstream] Worker already running.');
    return;
  }
  console.log(`[Downstream] Starting worker (interval: ${DOWNSTREAM_SYNC_INTERVAL_MS}ms, batch: ${DOWNSTREAM_SYNC_BATCH_SIZE})`);
  downstreamInterval = setInterval(() => {
    processDownstreamSync().catch(err => {
      console.error('[Downstream] Loop error:', err.message);
    });
  }, DOWNSTREAM_SYNC_INTERVAL_MS);
}

export function stopDownstreamSyncWorker(): void {
  if (downstreamInterval) {
    clearInterval(downstreamInterval);
    downstreamInterval = null;
    console.log('[Downstream] Worker stopped.');
  }
}
