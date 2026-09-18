const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
require('dotenv').config();

const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function run() {
  const neon = await pool.connect();
  try {
    const shifts = await prisma.shift.findMany({ orderBy: { id: 'asc' } });
    const shiftMappings = await prisma.localToCloudMapping.findMany({ where: { entityType: 'Shift' } });
    const neonShifts = await neon.query('SELECT id, device_id, local_id, shift_date, status, opened_by_uuid, closed_by_uuid FROM shifts');
    const queueShifts = await prisma.syncQueue.findMany({ where: { entityType: 'Shift' } });
    
    console.log('=== SQLITE SHIFTS (' + shifts.length + ') ===');
    console.log(JSON.stringify(shifts, null, 2));

    console.log('=== SHIFT MAPPINGS (' + shiftMappings.length + ') ===');
    console.log(JSON.stringify(shiftMappings, null, 2));

    console.log('=== NEON SHIFTS (' + neonShifts.rows.length + ') ===');
    console.log(JSON.stringify(neonShifts.rows, null, 2));

    console.log('=== SHIFT QUEUE EVENTS (' + queueShifts.length + ') ===');
    console.log(JSON.stringify(queueShifts.map(q => ({
      id: q.id, eventUuid: q.eventUuid, localId: q.localId, operation: q.operation, status: q.status, retryCount: q.retryCount, error: q.error, payload: JSON.parse(q.payload)
    })), null, 2));

    // Check all broken mappings generic check
    const NEON_TABLE_MAP = {
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

    const brokenMappings = [];
    const allMappings = await prisma.localToCloudMapping.findMany();
    for (const m of allMappings) {
      const table = NEON_TABLE_MAP[m.entityType];
      if (!table) continue;
      const res = await neon.query(`SELECT id FROM ${table} WHERE id = $1`, [m.cloudUuid]);
      if (res.rows.length === 0) {
        brokenMappings.push(m);
      }
    }
    console.log('=== BROKEN MAPPINGS (' + brokenMappings.length + ') ===');
    console.log(JSON.stringify(brokenMappings, null, 2));

  } catch(e) {
    console.error('Error during run:', e);
  } finally {
    neon.release();
    await pool.end();
    await prisma.$disconnect();
  }
}

run();
