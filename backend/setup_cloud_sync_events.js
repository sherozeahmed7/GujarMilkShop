const { Client } = require('pg');
require('dotenv').config();

async function setupCloudSyncEvents() {
  const client = new Client({ connectionString: process.env.NEON_DATABASE_URL });
  await client.connect();

  try {
    console.log('Creating cloud_sync_events table...');
    
    // Create the centralized event log with a monotonically increasing cursor
    await client.query(`
      CREATE TABLE IF NOT EXISTS cloud_sync_events (
        change_sequence BIGSERIAL PRIMARY KEY,
        event_uuid UUID UNIQUE NOT NULL,
        device_id VARCHAR(255) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        cloud_uuid UUID NOT NULL,
        operation VARCHAR(20) NOT NULL,
        payload JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('  cloud_sync_events created.');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cloud_sync_events_seq ON cloud_sync_events(change_sequence);
      CREATE INDEX IF NOT EXISTS idx_cloud_sync_events_device ON cloud_sync_events(device_id, change_sequence);
      CREATE INDEX IF NOT EXISTS idx_cloud_sync_events_entity ON cloud_sync_events(entity_type, cloud_uuid);
    `);
    console.log('  Indexes created.');

    await client.query(`
      ALTER TABLE supplier_payments
      ADD COLUMN IF NOT EXISTS shift_uuid UUID REFERENCES shifts(id)
    `);
    console.log('  Supplier payment shift links verified.');

    // Check current max sequence (for initial cursor computation)
    const maxSeq = await client.query(`SELECT COALESCE(MAX(change_sequence), 0) AS max_seq FROM cloud_sync_events`);
    console.log(`  Current max change_sequence: ${maxSeq.rows[0].max_seq}`);

    console.log('\nNeon cloud_sync_events setup complete.');
  } finally {
    await client.end();
  }
}

setupCloudSyncEvents().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
