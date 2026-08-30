import { getNeonPool } from './config/neonDb';
import dotenv from 'dotenv';
dotenv.config();

async function truncate() {
  const pool = getNeonPool();
  try {
    await pool.query('TRUNCATE users, suppliers, supplier_collections, supplier_payments, inventory_products, inventory_movements, shifts, daily_rates, customers, sales, sale_items, payments, milk_product_daily_stocks, milk_product_transactions, butter_ghee_conversions, expenses, expense_payments, returns, return_items, audit_records, idempotency_log CASCADE;');
    console.log('Truncated all Neon tables.');
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
truncate();
