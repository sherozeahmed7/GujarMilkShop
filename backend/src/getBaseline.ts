import { PrismaClient } from '@prisma/client';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const neon = new Client({ connectionString: process.env.NEON_DATABASE_URL });

async function getBaseline() {
  await neon.connect();
  try {
    const sqlite = {
      users: await prisma.user.count(),
      customers: await prisma.customer.count(),
      suppliers: await prisma.supplier.count(),
      products: await prisma.inventoryProduct.count(),
      salesCount: await prisma.sale.count(),
      salesTotal: (await prisma.sale.aggregate({ _sum: { totalAmount: true } }))._sum.totalAmount || 0,
      paymentsCount: await prisma.payment.count(),
      paymentsTotal: (await prisma.payment.aggregate({ _sum: { amount: true } }))._sum.amount || 0,
      collectionsCount: await prisma.supplierCollection.count(),
      collectionsTotal: (await prisma.supplierCollection.aggregate({ _sum: { amount: true } }))._sum.amount || 0,
      supplierPaymentsCount: await prisma.supplierPayment.count(),
      supplierPaymentsTotal: (await prisma.supplierPayment.aggregate({ _sum: { amount: true } }))._sum.amount || 0,
      inventoryMovements: await prisma.inventoryMovement.count(),
      expenses: await prisma.expense.count(),
      returns: await prisma.return.count(),
      f2: (await prisma.milkProductTransaction.count()) + (await prisma.butterGheeConversion.count()),
    };

    const nSalesTotal = await neon.query('SELECT SUM(total_amount) as total FROM sales');
    const nPaymentsTotal = await neon.query('SELECT SUM(amount) as total FROM payments');
    const nCollectionsTotal = await neon.query('SELECT SUM(amount) as total FROM supplier_collections');
    const nSupplierPaymentsTotal = await neon.query('SELECT SUM(amount) as total FROM supplier_payments');

    const neonData = {
      users: parseInt((await neon.query('SELECT COUNT(*) FROM users')).rows[0].count),
      customers: parseInt((await neon.query('SELECT COUNT(*) FROM customers')).rows[0].count),
      suppliers: parseInt((await neon.query('SELECT COUNT(*) FROM suppliers')).rows[0].count),
      products: parseInt((await neon.query('SELECT COUNT(*) FROM inventory_products')).rows[0].count),
      salesCount: parseInt((await neon.query('SELECT COUNT(*) FROM sales')).rows[0].count),
      salesTotal: parseFloat(nSalesTotal.rows[0].total || 0),
      paymentsCount: parseInt((await neon.query('SELECT COUNT(*) FROM payments')).rows[0].count),
      paymentsTotal: parseFloat(nPaymentsTotal.rows[0].total || 0),
      collectionsCount: parseInt((await neon.query('SELECT COUNT(*) FROM supplier_collections')).rows[0].count),
      collectionsTotal: parseFloat(nCollectionsTotal.rows[0].total || 0),
      supplierPaymentsCount: parseInt((await neon.query('SELECT COUNT(*) FROM supplier_payments')).rows[0].count),
      supplierPaymentsTotal: parseFloat(nSupplierPaymentsTotal.rows[0].total || 0),
      inventoryMovements: parseInt((await neon.query('SELECT COUNT(*) FROM inventory_movements')).rows[0].count),
      expenses: parseInt((await neon.query('SELECT COUNT(*) FROM expenses')).rows[0].count),
      returns: parseInt((await neon.query('SELECT COUNT(*) FROM returns')).rows[0].count),
      f2: parseInt((await neon.query('SELECT COUNT(*) FROM milk_product_transactions')).rows[0].count) + 
          parseInt((await neon.query('SELECT COUNT(*) FROM butter_ghee_conversions')).rows[0].count),
    };

    console.log(JSON.stringify({ sqlite, neon: neonData }, null, 2));

  } finally {
    await prisma.$disconnect();
    await neon.end();
  }
}

getBaseline().catch(console.error);
