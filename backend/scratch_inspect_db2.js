const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getNeonPool } = require('./src/config/neonDb'); // Assuming this exists or I can use pg directly

async function inspect() {
  // SQLite
  const sqliteTables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
  console.log('SQLite Tables:', sqliteTables);

  const sqliteSchema = {};
  for (const table of sqliteTables) {
    if (table.name.startsWith('sqlite_') || table.name.startsWith('_prisma_')) continue;
    const columns = await prisma.$queryRawUnsafe(`PRAGMA table_info(${table.name})`);
    sqliteSchema[table.name] = columns.map(c => c.name);
  }
  console.log('SQLite Schema:', JSON.stringify(sqliteSchema, null, 2));

  // Neon
  const pool = getNeonPool();
  const client = await pool.connect();
  const neonTablesRes = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
  const neonSchema = {};
  for (const row of neonTablesRes.rows) {
    const columnsRes = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [row.table_name]);
    neonSchema[row.table_name] = columnsRes.rows.map(r => r.column_name);
  }
  client.release();
  console.log('Neon Schema:', JSON.stringify(neonSchema, null, 2));

  process.exit(0);
}

inspect().catch(console.error);
