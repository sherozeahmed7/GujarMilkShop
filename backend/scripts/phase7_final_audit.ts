/**
 * Phase 7: Read-only final data flow & sync verification script
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function runAudit() {
  const neon = await pool.connect();
  try {
    console.log('=== 1. SQLITE VS NEON RECORD COUNTS ===');
    const tablePairs = [
      { name: 'Customer', sqlite: prisma.customer, neonTable: 'customers' },
      { name: 'Supplier', sqlite: prisma.supplier, neonTable: 'suppliers' },
      { name: 'Sale', sqlite: prisma.sale, neonTable: 'sales' },
      { name: 'SaleItem', sqlite: prisma.saleItem, neonTable: 'sale_items' },
      { name: 'Payment', sqlite: prisma.payment, neonTable: 'payments' },
      { name: 'InventoryProduct', sqlite: prisma.inventoryProduct, neonTable: 'inventory_products' },
      { name: 'InventoryMovement', sqlite: prisma.inventoryMovement, neonTable: 'inventory_movements' },
      { name: 'Shift', sqlite: prisma.shift, neonTable: 'shifts' },
      { name: 'SupplierCollection', sqlite: prisma.supplierCollection, neonTable: 'supplier_collections' },
      { name: 'SupplierPayment', sqlite: prisma.supplierPayment, neonTable: 'supplier_payments' },
      { name: 'Expense', sqlite: prisma.expense, neonTable: 'expenses' },
      { name: 'Return', sqlite: prisma.return, neonTable: 'returns' },
    ];

    for (const tp of tablePairs) {
      const sqCount = await (tp.sqlite as any).count();
      const nRes = await neon.query(`SELECT count(*) FROM ${tp.neonTable}`);
      const nCount = Number(nRes.rows[0].count);
      console.log(`${tp.name.padEnd(20)}: SQLite=${String(sqCount).padEnd(4)} Neon=${String(nCount).padEnd(4)} Matches=${sqCount === nCount ? 'YES' : 'DIFF'}`);
    }

    console.log('\n=== 2. SYNC QUEUE & MAPPINGS STATUS ===');
    const queueCounts = await prisma.syncQueue.groupBy({
      by: ['status'],
      _count: { status: true }
    });
    console.log('SyncQueue status counts:', queueCounts);

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
    let brokenMappings = 0;
    for (const m of allMappings) {
      const t = NEON_TABLE_MAP[m.entityType];
      if (!t) continue;
      const res = await neon.query(`SELECT id FROM ${t} WHERE id=$1`, [m.cloudUuid]);
      if (res.rows.length === 0) {
        console.log(`Broken mapping: ${m.entityType} localId=${m.localId} cloudUuid=${m.cloudUuid}`);
        brokenMappings++;
      }
    }
    console.log(`Total LocalToCloudMappings: ${allMappings.length}, Broken: ${brokenMappings}`);

    console.log('\n=== 3. REAL SALE TRACE IN SQLITE & NEON ===');
    const sampleSale = await prisma.sale.findFirst({
      where: { items: { some: {} } },
      include: { items: true, payments: true },
      orderBy: { id: 'desc' }
    });

    if (sampleSale) {
      console.log(`Sample SQLite Sale ID: ${sampleSale.id}, Total: Rs. ${sampleSale.totalAmount}, Items: ${sampleSale.items.length}, Payments: ${sampleSale.payments.length}`);
      const saleMap = await prisma.localToCloudMapping.findFirst({ where: { entityType: 'Sale', localId: sampleSale.id } });
      console.log(`Sale Cloud UUID: ${saleMap?.cloudUuid}`);
      
      const neonSale = await neon.query('SELECT * FROM sales WHERE id=$1', [saleMap?.cloudUuid]);
      console.log(`Neon Sale Exists: ${neonSale.rows.length > 0}`);

      if (sampleSale.items[0]) {
        const itemMap = await prisma.localToCloudMapping.findFirst({ where: { entityType: 'SaleItem', localId: sampleSale.items[0].id } });
        const neonItem = await neon.query('SELECT * FROM sale_items WHERE id=$1', [itemMap?.cloudUuid]);
        console.log(`SaleItem #${sampleSale.items[0].id} Cloud UUID: ${itemMap?.cloudUuid}, Exists in Neon: ${neonItem.rows.length > 0}, Linked sale_uuid in Neon: ${neonItem.rows[0]?.sale_uuid === saleMap?.cloudUuid}`);
      }

      if (sampleSale.payments[0]) {
        const payMap = await prisma.localToCloudMapping.findFirst({ where: { entityType: 'Payment', localId: sampleSale.payments[0].id } });
        const neonPay = await neon.query('SELECT * FROM payments WHERE id=$1', [payMap?.cloudUuid]);
        console.log(`Payment #${sampleSale.payments[0].id} Cloud UUID: ${payMap?.cloudUuid}, Exists in Neon: ${neonPay.rows.length > 0}, Linked sale_uuid in Neon: ${neonPay.rows[0]?.sale_uuid === saleMap?.cloudUuid}`);
      }
    }

  } finally {
    neon.release();
    await pool.end();
    await prisma.$disconnect();
  }
}

runAudit();
