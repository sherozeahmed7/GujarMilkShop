const { Client } = require('pg');
require('dotenv').config();

async function cleanNeon() {
  const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await client.connect();
  
  await client.query("DELETE FROM customers WHERE name LIKE '%Test%'");
  console.log('Cleaned Neon');
  await client.end();
}
cleanNeon();
