import { getNeonPool } from './src/config/neonDb';

async function checkNeonProducts() {
  const pool = getNeonPool();
  const client = await pool.connect();

  try {
    const res = await client.query('SELECT id, code, name FROM inventory_products');
    console.log('Neon inventory products:', res.rows);
  } finally {
    client.release();
  }
}

checkNeonProducts().finally(() => process.exit(0));
