import { prisma } from './config/database';
import { SyncQueueService } from './services/syncQueue.service';
import { getNeonPool } from './config/neonDb';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

// ─── Config ──────────────────────────────────────────────────────────────────
const API_URL = 'http://localhost:5000/api/sync/migrate';
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const BATCH_SIZE = 500;
const migrationId = `mig-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const startTime = Date.now();

// ─── Auth Token ───────────────────────────────────────────────────────────────
const token = jwt.sign(
  { id: 0, name: 'MigrationClient', email: 'migration@internal', role: 'super_admin', status: 'active' },
  JWT_SECRET,
  { expiresIn: '2h' }
);
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

// ─── Helpers ─────────────────────────────────────────────────────────────────
let batchCounter = 0;

async function sendBatch(payloads: any[]): Promise<any> {
  batchCounter++;
  const batchId = batchCounter;
  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ migrationId, batchId, payloads }),
  });
  const data = await res.json();
  if (data.status !== 'success') {
    throw new Error(`Batch ${batchId} failed: ${data.error}`);
  }
  return data;
}

// Resolve cloud UUID — reuse if exists, create if not
async function mapUuid(entityType: string, localId: number): Promise<string> {
  const existing = await SyncQueueService.getCloudMapping(entityType, localId);
  if (existing) return existing;
  return await SyncQueueService.createCloudMapping(entityType, localId);
}

async function resolveUuid(entityType: string, localId: number | null): Promise<string | null> {
  if (localId == null) return null;
  const uuid = await SyncQueueService.getCloudMapping(entityType, localId);
  if (!uuid) throw new Error(`Missing mapping: ${entityType} localId=${localId}`);
  return uuid;
}

// ─── Safety Checks ────────────────────────────────────────────────────────────
async function safetyChecks(pool: any) {
  console.log('\n[SAFETY] Verifying pre-conditions...');

  const dbPath = path.join(process.cwd(), 'prisma', 'prisma', 'dev.db');
  const backupPath = path.join(process.cwd(), 'prisma', 'prisma', 'dev_backup.db');

  if (!fs.existsSync(dbPath)) throw new Error('ABORT: Active dev.db not found.');
  if (!fs.existsSync(backupPath)) throw new Error('ABORT: Backup not found.');
  const backupStat = fs.statSync(backupPath);
  if (backupStat.size === 0) throw new Error('ABORT: Backup file is empty.');
  console.log(`[SAFETY] ✅ DB Path:    ${dbPath}`);
  console.log(`[SAFETY] ✅ Backup:     ${backupPath} (${backupStat.size} bytes)`);

  // Verify Neon has zero business records
  const checks = ['customers','users','suppliers','sales','payments'];
  for (const table of checks) {
    const r = await pool.query(`SELECT COUNT(*) FROM ${table}`);
    if (parseInt(r.rows[0].count) > 0) {
      throw new Error(`ABORT: Neon table '${table}' already has ${r.rows[0].count} records. Migration would create duplicates.`);
    }
  }
  console.log(`[SAFETY] ✅ Neon has zero business records.`);
}

// ─── Entity Migrators ─────────────────────────────────────────────────────────

async function migrateUsers() {
  const records = await prisma.user.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('User', r.id);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'User', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        name: r.name || '', email: r.email, password: r.password,
        role: r.role, status: r.status, assigned_screens: r.assignedScreens,
        created_at: r.createdAt, updated_at: r.updatedAt,
      },
    });
  }
  return payloads;
}

async function migrateSuppliers() {
  const records = await prisma.supplier.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('Supplier', r.id);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'Supplier', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        name: r.name, code: r.code, phone: r.phone,
        default_rate: r.defaultRate, cow_rate: r.cowRate, buffalo_rate: r.buffaloRate,
        cycle_type: r.cycleType, is_active: r.isActive, guaranteed_advance: r.guaranteedAdvance,
        created_at: r.createdAt, updated_at: r.updatedAt,
      },
    });
  }
  return payloads;
}

async function migrateInventoryProducts() {
  const records = await prisma.inventoryProduct.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('InventoryProduct', r.id);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'InventoryProduct', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        code: r.code, name: r.name, description: r.description, category: r.category,
        unit: r.unit, tax: r.tax, low_stock_threshold: r.lowStockThreshold,
        is_active: r.isActive, is_locked: r.isLocked,
        created_at: r.createdAt, updated_at: r.updatedAt,
      },
    });
  }
  return payloads;
}

async function migrateDailyRates() {
  const records = await prisma.dailyRate.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('DailyRate', r.id);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'DailyRate', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        milk_rate: r.milkRate, yogurt_rate: r.yogurtRate, lassi_rate: r.lassiRate,
        butter_rate: r.butterRate, ghee_rate: r.gheeRate,
        updated_by_role: r.updatedByRole, date: r.date,
        created_at: r.createdAt,
      },
    });
  }
  return payloads;
}

async function migrateCustomers() {
  const records = await prisma.customer.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('Customer', r.id);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'Customer', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        name: r.name, phone: r.phone, address: r.address,
        customer_type: r.customerType, status: r.status,
        created_at: r.createdAt, updated_at: r.updatedAt,
      },
    });
  }
  return payloads;
}

async function migrateShifts() {
  const records = await prisma.shift.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('Shift', r.id);
    const openedByUuid = await resolveUuid('User', r.openedById);
    const closedByUuid = await resolveUuid('User', r.closedById);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'Shift', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        shift_date: r.shiftDate, opened_by_uuid: openedByUuid, closed_by_uuid: closedByUuid,
        opened_at: r.openedAt, closed_at: r.closedAt,
        opening_cash: r.openingCash, opening_notes: r.openingNotes,
        expected_cash: r.expectedCash, counted_cash: r.countedCash,
        difference: r.difference, difference_status: r.differenceStatus,
        closing_notes: r.closingNotes, status: r.status,
        created_at: r.createdAt, updated_at: r.updatedAt,
      },
    });
  }
  return payloads;
}

async function migrateSupplierCollections() {
  const records = await prisma.supplierCollection.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('SupplierCollection', r.id);
    const supplierUuid = await resolveUuid('Supplier', r.supplierId);
    const createdByUuid = await resolveUuid('User', r.createdById);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'SupplierCollection', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        supplier_uuid: supplierUuid, date: r.date, shift: r.shift,
        milk_type: r.milkType, quantity: r.quantity, rate: r.rate, amount: r.amount,
        notes: r.notes, created_by_uuid: createdByUuid,
        created_at: r.createdAt, updated_at: r.updatedAt,
      },
    });
  }
  return payloads;
}

async function migrateSupplierPayments() {
  const records = await prisma.supplierPayment.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('SupplierPayment', r.id);
    const supplierUuid = await resolveUuid('Supplier', r.supplierId);
    const createdByUuid = await resolveUuid('User', r.createdById);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'SupplierPayment', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        supplier_uuid: supplierUuid, date: r.date, amount: r.amount,
        shift_uuid: await resolveUuid('Shift', r.shiftId),
        method: r.method, notes: r.notes, created_by_uuid: createdByUuid,
        created_at: r.createdAt,
      },
    });
  }
  return payloads;
}

async function migrateSales() {
  const records = await prisma.sale.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('Sale', r.id);
    const customerUuid = await resolveUuid('Customer', r.customerId);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'Sale', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        sale_type: r.saleType, customer_uuid: customerUuid,
        customer_name: r.customerName, customer_phone: r.customerPhone,
        total_amount: r.totalAmount, paid_amount: r.paidAmount,
        remaining_balance: r.remainingBalance, status: r.status,
        created_at: r.createdAt, updated_at: r.updatedAt,
      },
    });
  }
  return payloads;
}

async function migrateSaleItems() {
  const records = await prisma.saleItem.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('SaleItem', r.id);
    const saleUuid = await resolveUuid('Sale', r.saleId);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'SaleItem', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        sale_uuid: saleUuid, item_name: r.itemName, quantity: r.quantity,
        unit_price: r.unitPrice, total_price: r.totalPrice, created_at: r.createdAt,
      },
    });
  }
  return payloads;
}

async function migratePayments() {
  const records = await prisma.payment.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('Payment', r.id);
    const saleUuid = await resolveUuid('Sale', r.saleId);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'Payment', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        sale_uuid: saleUuid, method: r.method, amount: r.amount,
        status: r.status, created_at: r.createdAt,
      },
    });
  }
  return payloads;
}

async function migrateExpenses() {
  const records = await prisma.expense.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('Expense', r.id);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'Expense', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        date: r.date, category: r.category, description: r.description,
        quantity: r.quantity, unit_cost: r.unitCost, gross_loss: r.grossLoss,
        sold_recovery: r.soldRecovery, net_expense: r.netExpense,
        amount: r.amount, paid_amount: r.paidAmount, remaining: r.remaining,
        reason: r.reason, added_by: r.addedBy,
        created_at: r.createdAt, updated_at: r.updatedAt,
      },
    });
  }
  return payloads;
}

async function migrateExpensePayments() {
  const records = await prisma.expensePayment.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('ExpensePayment', r.id);
    const expenseUuid = await resolveUuid('Expense', r.expenseId);
    const shiftUuid = await resolveUuid('Shift', r.shiftId);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'ExpensePayment', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        expense_uuid: expenseUuid, shift_uuid: shiftUuid,
        amount: r.amount, date: r.date, added_by: r.addedBy, created_at: r.createdAt,
      },
    });
  }
  return payloads;
}

async function migrateInventoryMovements() {
  const records = await prisma.inventoryMovement.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('InventoryMovement', r.id);
    const productUuid = await resolveUuid('InventoryProduct', r.productId);
    const supplierUuid = await resolveUuid('Supplier', r.supplierId);
    const shiftUuid = await resolveUuid('Shift', r.shiftId);
    const userUuid = await resolveUuid('User', r.userId);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'InventoryMovement', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        product_uuid: productUuid, quantity: r.quantity, movement_type: r.movementType,
        source: r.source, reference: r.reference, unit_cost: r.unitCost,
        supplier_uuid: supplierUuid, shift_uuid: shiftUuid, user_uuid: userUuid,
        date: r.date, created_at: r.createdAt,
      },
    });
  }
  return payloads;
}

async function migrateMilkProductTransactions() {
  const records = await prisma.milkProductTransaction.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('MilkProductTransaction', r.id);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'MilkProductTransaction', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        date: r.date, product: r.product, type: r.type,
        quantity: r.quantity, reference: r.reference, notes: r.notes, created_at: r.createdAt,
      },
    });
  }
  return payloads;
}

async function migrateButterGheeConversions() {
  const records = await prisma.butterGheeConversion.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('ButterGheeConversion', r.id);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'ButterGheeConversion', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        date: r.date, butter_used: r.butterUsed, ghee_produced: r.gheeProduced,
        notes: r.notes, created_at: r.createdAt,
      },
    });
  }
  return payloads;
}

async function migrateMilkProductDailyStocks() {
  const records = await prisma.milkProductDailyStock.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('MilkProductDailyStock', r.id);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'MilkProductDailyStock', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        date: r.date, milk_total: r.milkTotal,
        lassi_produced: r.lassiProduced, lassi_sold: r.lassiSold, lassi_remaining: r.lassiRemaining,
        butter_opening: r.butterOpening, butter_produced: r.butterProduced,
        butter_sold: r.butterSold, butter_converted: r.butterConverted, butter_closing: r.butterClosing,
        ghee_opening: r.gheeOpening, ghee_produced: r.gheeProduced,
        ghee_sold: r.gheeSold, ghee_closing: r.gheeClosing,
        created_at: r.createdAt, updated_at: r.updatedAt,
      },
    });
  }
  return payloads;
}

async function migrateReturns() {
  const records = await prisma.return.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('Return', r.id);
    const saleUuid = await resolveUuid('Sale', r.saleId);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'Return', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        sale_uuid: saleUuid, bill_number: r.billNumber, date: r.date,
        customer: r.customer, return_type: r.returnType,
        refund_amount: r.refundAmount, payment_method: r.paymentMethod,
        reason: r.reason, status: r.status, processed_by: r.processedBy,
        created_at: r.createdAt, updated_at: r.updatedAt,
      },
    });
  }
  return payloads;
}

async function migrateReturnItems() {
  const records = await prisma.returnItem.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('ReturnItem', r.id);
    const returnUuid = await resolveUuid('Return', r.returnId);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'ReturnItem', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        return_uuid: returnUuid, item_id: r.itemId, name: r.name,
        return_qty: r.returnQty, unit_price: r.unitPrice, refund_amount: r.refundAmount,
      },
    });
  }
  return payloads;
}

async function migrateAuditRecords() {
  const records = await prisma.auditRecord.findMany();
  const payloads = [];
  for (const r of records) {
    const cloudUuid = await mapUuid('AuditRecord', r.id);
    payloads.push({
      eventUuid: crypto.randomUUID(), deviceId: SyncQueueService.getDeviceId(),
      entityType: 'AuditRecord', localId: r.id, cloudUuid, operation: 'CREATE',
      payload: {
        id: cloudUuid, local_id: r.id, device_id: SyncQueueService.getDeviceId(),
        audit_date: r.auditDate, executed_at: r.executedAt,
        total_pos_bills: r.totalPosBills, collected_receipts: r.collectedReceipts,
        matched: r.matched, missing: r.missing, extra: r.extra, duplicates: r.duplicates,
        status: r.status, notes: r.notes, audited_by: r.auditedBy, created_at: r.createdAt,
      },
    });
  }
  return payloads;
}

// ─── Batch Sender ─────────────────────────────────────────────────────────────
async function migrateEntity(name: string, payloads: any[]) {
  if (payloads.length === 0) {
    console.log(`  [SKIP] ${name}: 0 records`);
    return { inserted: 0, skipped: 0 };
  }
  // chunk into batches
  let totalInserted = 0, totalSkipped = 0;
  for (let i = 0; i < payloads.length; i += BATCH_SIZE) {
    const chunk = payloads.slice(i, i + BATCH_SIZE);
    const result = await sendBatch(chunk);
    totalInserted += result.recordsInserted;
    totalSkipped += result.recordsSkipped;
  }
  console.log(`  ✅ ${name}: inserted=${totalInserted}, skipped=${totalSkipped}`);
  return { inserted: totalInserted, skipped: totalSkipped };
}

// ─── Validation ───────────────────────────────────────────────────────────────
async function validate(pool: any) {
  console.log('\n========== VALIDATION ==========');

  const checks: Array<{
    entity: string;
    sqliteCount: number;
    sqliteSum?: number;
    sqliteSumLabel?: string;
    neonTable: string;
    neonSumCol?: string;
  }> = [
    { entity: 'User',                 sqliteCount: await prisma.user.count(),                     neonTable: 'users' },
    { entity: 'Supplier',             sqliteCount: await prisma.supplier.count(),                   neonTable: 'suppliers' },
    { entity: 'InventoryProduct',     sqliteCount: await prisma.inventoryProduct.count(),            neonTable: 'inventory_products' },
    { entity: 'DailyRate',            sqliteCount: await prisma.dailyRate.count(),                   neonTable: 'daily_rates' },
    { entity: 'Customer',             sqliteCount: await prisma.customer.count(),                    neonTable: 'customers' },
    { entity: 'Shift',                sqliteCount: await prisma.shift.count(),                       neonTable: 'shifts' },
    { entity: 'SupplierCollection',   sqliteCount: await prisma.supplierCollection.count(),          neonTable: 'supplier_collections',
      sqliteSum: Number((await prisma.supplierCollection.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0), sqliteSumLabel: 'amount' },
    { entity: 'SupplierPayment',      sqliteCount: await prisma.supplierPayment.count(),             neonTable: 'supplier_payments',
      sqliteSum: Number((await prisma.supplierPayment.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0), sqliteSumLabel: 'amount' },
    { entity: 'Sale',                 sqliteCount: await prisma.sale.count(),                        neonTable: 'sales',
      sqliteSum: Number((await prisma.sale.aggregate({ _sum: { totalAmount: true } }))._sum.totalAmount ?? 0), sqliteSumLabel: 'total_amount' },
    { entity: 'SaleItem',             sqliteCount: await prisma.saleItem.count(),                    neonTable: 'sale_items' },
    { entity: 'Payment',              sqliteCount: await prisma.payment.count(),                     neonTable: 'payments',
      sqliteSum: Number((await prisma.payment.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0), sqliteSumLabel: 'amount' },
    { entity: 'Expense',              sqliteCount: await prisma.expense.count(),                     neonTable: 'expenses',
      sqliteSum: Number((await prisma.expense.aggregate({ _sum: { amount: true } }))._sum.amount ?? 0), sqliteSumLabel: 'amount' },
    { entity: 'ExpensePayment',       sqliteCount: await prisma.expensePayment.count(),              neonTable: 'expense_payments' },
    { entity: 'InventoryMovement',    sqliteCount: await prisma.inventoryMovement.count(),           neonTable: 'inventory_movements',
      sqliteSum: Number((await prisma.inventoryMovement.aggregate({ _sum: { quantity: true } }))._sum.quantity ?? 0), sqliteSumLabel: 'quantity' },
    { entity: 'MilkProductTransaction', sqliteCount: await prisma.milkProductTransaction.count(),   neonTable: 'milk_product_transactions' },
    { entity: 'ButterGheeConversion', sqliteCount: await prisma.butterGheeConversion.count(),        neonTable: 'butter_ghee_conversions' },
    { entity: 'MilkProductDailyStock', sqliteCount: await prisma.milkProductDailyStock.count(),     neonTable: 'milk_product_daily_stocks' },
    { entity: 'Return',               sqliteCount: await prisma.return.count(),                      neonTable: 'returns' },
    { entity: 'ReturnItem',           sqliteCount: await prisma.returnItem.count(),                  neonTable: 'return_items' },
    { entity: 'AuditRecord',          sqliteCount: await prisma.auditRecord.count(),                 neonTable: 'audit_records' },
  ];

  let allPassed = true;
  for (const c of checks) {
    const neonCount = parseInt((await pool.query(`SELECT COUNT(*) FROM ${c.neonTable}`)).rows[0].count);
    const countOk = neonCount === c.sqliteCount;
    if (!countOk) allPassed = false;
    const countStr = countOk ? '✅' : '❌';
    if (c.sqliteSum !== undefined && c.neonSumCol === undefined && c.sqliteSumLabel) {
      // need neon sum
      const neonSum = parseFloat((await pool.query(`SELECT COALESCE(SUM(${c.sqliteSumLabel}),0) FROM ${c.neonTable}`)).rows[0].coalesce);
      const sumOk = Math.abs(neonSum - c.sqliteSum) < 0.01;
      if (!sumOk) allPassed = false;
      const sumStr = sumOk ? '✅' : '❌';
      console.log(`${countStr} ${c.entity}: count ${c.sqliteCount}/${neonCount}  ${sumStr} sum ${c.sqliteSum}/${neonSum}`);
    } else {
      console.log(`${countStr} ${c.entity}: count ${c.sqliteCount}/${neonCount}`);
    }
  }

  // Orphan checks
  console.log('\n--- Orphan / FK Checks ---');
  const orphanQueries = [
    { label: 'SaleItems orphan', sql: `SELECT COUNT(*) FROM sale_items si LEFT JOIN sales s ON si.sale_uuid=s.id WHERE s.id IS NULL` },
    { label: 'Payments orphan', sql: `SELECT COUNT(*) FROM payments p LEFT JOIN sales s ON p.sale_uuid=s.id WHERE s.id IS NULL` },
    { label: 'SupplierCollections orphan', sql: `SELECT COUNT(*) FROM supplier_collections sc LEFT JOIN suppliers s ON sc.supplier_uuid=s.id WHERE s.id IS NULL` },
    { label: 'InventoryMovements orphan', sql: `SELECT COUNT(*) FROM inventory_movements im LEFT JOIN inventory_products ip ON im.product_uuid=ip.id WHERE ip.id IS NULL` },
    { label: 'ReturnItems orphan', sql: `SELECT COUNT(*) FROM return_items ri LEFT JOIN returns r ON ri.return_uuid=r.id WHERE r.id IS NULL` },
    { label: 'ExpensePayments orphan', sql: `SELECT COUNT(*) FROM expense_payments ep LEFT JOIN expenses e ON ep.expense_uuid=e.id WHERE e.id IS NULL` },
  ];
  for (const q of orphanQueries) {
    const count = parseInt((await pool.query(q.sql)).rows[0].count);
    const ok = count === 0;
    if (!ok) allPassed = false;
    console.log(`${ok ? '✅' : '❌'} ${q.label}: ${count} orphans`);
  }

  return allPassed;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=================================================');
  console.log('PHASE 4B — REAL SQLITE → NEON MIGRATION');
  console.log(`Migration ID: ${migrationId}`);
  console.log('=================================================');

  const pool = getNeonPool();

  try {
    await safetyChecks(pool);

    console.log('\n[MIGRATE] Starting entity migration in dependency order...');
    const steps: Array<[string, () => Promise<any[]>]> = [
      ['User',                  migrateUsers],
      ['Supplier',              migrateSuppliers],
      ['InventoryProduct',      migrateInventoryProducts],
      ['DailyRate',             migrateDailyRates],
      ['Customer',              migrateCustomers],
      ['Shift',                 migrateShifts],
      ['SupplierCollection',    migrateSupplierCollections],
      ['SupplierPayment',       migrateSupplierPayments],
      ['Sale',                  migrateSales],
      ['SaleItem',              migrateSaleItems],
      ['Payment',               migratePayments],
      ['Expense',               migrateExpenses],
      ['ExpensePayment',        migrateExpensePayments],
      ['InventoryMovement',     migrateInventoryMovements],
      ['MilkProductTransaction', migrateMilkProductTransactions],
      ['ButterGheeConversion',  migrateButterGheeConversions],
      ['MilkProductDailyStock', migrateMilkProductDailyStocks],
      ['Return',                migrateReturns],
      ['ReturnItem',            migrateReturnItems],
      ['AuditRecord',           migrateAuditRecords],
    ];

    let totalInserted = 0;
    for (const [name, fn] of steps) {
      const payloads = await fn();
      const { inserted } = await migrateEntity(name, payloads);
      totalInserted += inserted;
    }

    console.log(`\n[MIGRATE] ✅ All entities migrated. Total records inserted: ${totalInserted}`);
    console.log(`[MIGRATE] Migration ID: ${migrationId} | Batches: ${batchCounter}`);

    const allPassed = await validate(pool);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n=================================================');
    if (allPassed) {
      console.log(`✅ MIGRATION COMPLETE`);
    } else {
      console.log(`❌ MIGRATION COMPLETED WITH VALIDATION FAILURES`);
    }
    console.log(`Duration: ${duration}s | migrationId: ${migrationId}`);
    console.log('=================================================');

  } catch (err: any) {
    console.error('\n❌ MIGRATION ABORTED:', err.message);
  } finally {
    await pool.end();
    await prisma.$disconnect();
  }
}

main();
