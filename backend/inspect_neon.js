const { Client } = require('pg');
require('dotenv').config();
const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
client.connect()
  .then(() => client.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' ORDER BY table_name, ordinal_position;"))
  .then(res => { 
     console.log(JSON.stringify(res.rows, null, 2)); 
     client.end(); 
  })
  .catch(console.error);
