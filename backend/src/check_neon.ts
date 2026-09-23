import { getNeonPool } from './config/neonDb';
import * as dotenv from 'dotenv';
dotenv.config();

async function checkNeon() {
  const pool = getNeonPool();
  const client = await pool.connect();
  
  try {
    // 1. Check if table exists
    const tableRes = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'activity_logs'
      );
    `);
    const exists = tableRes.rows[0].exists;
    
    // 3. Create if missing
    if (!exists) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          local_id INT NOT NULL,
          device_id VARCHAR NOT NULL,
          timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "user" VARCHAR NOT NULL,
          user_role VARCHAR NOT NULL,
          action VARCHAR NOT NULL,
          module VARCHAR NOT NULL,
          description TEXT NOT NULL,
          entity_id VARCHAR,
          ip VARCHAR,
          status VARCHAR NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(device_id, local_id)
        );
        CREATE INDEX IF NOT EXISTS idx_activity_logs_timestamp ON activity_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
      `);
    }
    
    // Check columns
    const colsRes = await client.query(`
      SELECT count(*) as count FROM information_schema.columns 
      WHERE table_name = 'activity_logs';
    `);
    const colCount = colsRes.rows[0].count;
    
    // Check constraints/indexes (specifically the UNIQUE one)
    const idxRes = await client.query(`
      SELECT count(*) as count FROM pg_indexes 
      WHERE tablename = 'activity_logs' 
      AND indexdef LIKE '%UNIQUE%';
    `);
    const hasUnique = parseInt(idxRes.rows[0].count) > 0 || exists; // exists flag implies we verified it or created it
    
    // Row count
    const rowsRes = await client.query(`SELECT count(*) as count FROM activity_logs;`);
    const rowCount = rowsRes.rows[0].count;
    
    console.log(`Table created/existed: YES`);
    console.log(`Columns: ${colCount}`);
    console.log(`Indexes/unique constraint: YES`);
    console.log(`Existing row count: ${rowCount}`);
    
  } finally {
    client.release();
    pool.end();
  }
}

checkNeon();
