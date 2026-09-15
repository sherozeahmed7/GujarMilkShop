const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

async function inspectNeon() {
  const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await client.connect();

  console.log('--- Checking inventory_products in Neon ---');
  const prods = await client.query('SELECT id, device_id, local_id, code, name FROM inventory_products');
  console.table(prods.rows);

  console.log('\n--- Checking unique constraints on inventory_products ---');
  const constraints = await client.query(`
    SELECT conname, pg_get_constraintdef(c.oid)
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conrelid = 'inventory_products'::regclass
  `);
  console.table(constraints.rows);

  console.log('\n--- Checking columns of supplier_collections in Neon ---');
  const scCols = await client.query(`
    SELECT column_name, is_nullable, data_type, column_default
    FROM information_schema.columns
    WHERE table_name = 'supplier_collections'
  `);
  console.table(scCols.rows);

  await client.end();
}

inspectNeon().catch(console.error);
