const { Client } = require('pg');
require('dotenv').config();
const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
client.connect()
  .then(() => client.query("DELETE FROM customers WHERE name = 'Test Sync Customer'"))
  .then(() => { console.log('Cleaned'); client.end(); })
  .catch(console.error);
