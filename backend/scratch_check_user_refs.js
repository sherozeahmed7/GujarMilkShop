require('dotenv').config();
const { Pool } = require('pg');

async function inspect() {
  const pool = new Pool({
    connectionString: process.env.NEON_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const placeholderId = '96aa03d0-80d2-4dc0-bb14-b64ef111c21f';
    const realId = 'fa7521f4-3731-447a-bdd8-eccc146271e9';

    const userRows = await pool.query(`SELECT id, device_id, local_id, email, name, role FROM users WHERE id IN ($1, $2)`, [placeholderId, realId]);
    console.log('--- Users ---');
    console.table(userRows.rows);

    // Check FK references to placeholderId
    const shifts = await pool.query(`SELECT id, shift_date, opened_by_uuid, closed_by_uuid FROM shifts WHERE opened_by_uuid=$1 OR closed_by_uuid=$1`, [placeholderId]);
    console.log('Shifts referencing placeholder:', shifts.rowCount);

    const movements = await pool.query(`SELECT id, reference, user_uuid FROM inventory_movements WHERE user_uuid=$1`, [placeholderId]);
    console.log('InventoryMovements referencing placeholder:', movements.rowCount);

    const collections = await pool.query(`SELECT id, created_by_uuid FROM supplier_collections WHERE created_by_uuid=$1`, [placeholderId]);
    console.log('SupplierCollections referencing placeholder:', collections.rowCount);

    const payments = await pool.query(`SELECT id, created_by_uuid FROM supplier_payments WHERE created_by_uuid=$1`, [placeholderId]);
    console.log('SupplierPayments referencing placeholder:', payments.rowCount);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

inspect();
