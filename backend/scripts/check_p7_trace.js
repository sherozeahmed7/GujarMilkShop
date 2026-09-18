const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
require('dotenv').config();

const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

async function run() {
  const neon = await pool.connect();
  try {
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

    const allMappings = await prisma.localToCloudMapping.findMany();
    let brokenMappings = 0;
    for (const m of allMappings) {
      const t = NEON_TABLE_MAP[m.entityType];
      if (!t) continue;
      const res = await neon.query(`SELECT id FROM ${t} WHERE id = $1`, [m.cloudUuid]);
      if (res.rows.length === 0) {
        console.log(`Broken: ${m.entityType} #${m.localId} -> ${m.cloudUuid}`);
        brokenMappings++;
      }
    }
    console.log(`=== Total Mappings: ${allMappings.length}, Broken Mappings: ${brokenMappings} ===`);

    const lastSale = await prisma.sale.findFirst({
      where: { items: { some: {} } },
      include: { items: true, payments: true },
      orderBy: { id: 'desc' }
    });
    console.log('=== REAL SALE TRACE ===');
    console.log('Last Sale ID:', lastSale.id, 'Total:', lastSale.totalAmount);
    const saleMap = await prisma.localToCloudMapping.findFirst({ where: { entityType: 'Sale', localId: lastSale.id } });
    const itemMap = await prisma.localToCloudMapping.findFirst({ where: { entityType: 'SaleItem', localId: lastSale.items[0].id } });
    const payMap = await prisma.localToCloudMapping.findFirst({ where: { entityType: 'Payment', localId: lastSale.payments[0].id } });
    
    console.log('Sale Cloud UUID:', saleMap?.cloudUuid);
    console.log('SaleItem Cloud UUID:', itemMap?.cloudUuid);
    console.log('Payment Cloud UUID:', payMap?.cloudUuid);

    const neonSale = await neon.query('SELECT id, total_amount, paid_amount FROM sales WHERE id = $1', [saleMap?.cloudUuid]);
    const neonItem = await neon.query('SELECT id, sale_uuid, item_name, total_price FROM sale_items WHERE id = $1', [itemMap?.cloudUuid]);
    const neonPay = await neon.query('SELECT id, sale_uuid, amount, method FROM payments WHERE id = $1', [payMap?.cloudUuid]);

    console.log('Neon Sale:', neonSale.rows[0]);
    console.log('Neon SaleItem:', neonItem.rows[0]);
    console.log('Neon Payment:', neonPay.rows[0]);
    console.log('FK Linked Correctly in Neon:', neonItem.rows[0]?.sale_uuid === saleMap?.cloudUuid && neonPay.rows[0]?.sale_uuid === saleMap?.cloudUuid);

  } catch(e) {
    console.error(e);
  } finally {
    neon.release();
    await pool.end();
    await prisma.$disconnect();
  }
}

run();
