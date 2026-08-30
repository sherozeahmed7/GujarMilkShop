import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { getNeonPool } from './config/neonDb';

dotenv.config();

const API_URL = 'http://localhost:5000/api/sync/migrate';
const SECRET = process.env.JWT_SECRET || 'secret';

// Generate a Super Admin token
const token = jwt.sign(
  { id: 999, name: 'Migration Tester', email: 'test@mig.com', role: 'super_admin', status: 'active' },
  SECRET,
  { expiresIn: '1h' }
);

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${token}`
};

async function sendBatch(payload: any) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  return { status: res.status, data: await res.json() };
}

async function runTests() {
  console.log('--- Phase 4A: Migration API Testing ---');
  const pool = getNeonPool();

  try {
    // 0. Clean Test State
    await pool.query("DELETE FROM customers WHERE name LIKE 'TestMig%'");
    await pool.query("DELETE FROM idempotency_log WHERE event_uuid = '11111111-1111-1111-1111-111111111111'");
    await pool.query("DELETE FROM idempotency_log WHERE event_uuid = '22222222-2222-2222-2222-222222222222'");

    // 1. Successful CREATE
    console.log('\nTest 1: Successful CREATE');
    const res1 = await sendBatch({
      migrationId: 'test-mig-1',
      batchId: 1,
      payloads: [
        {
          eventUuid: '11111111-1111-1111-1111-111111111111',
          deviceId: 'TEST-1',
          entityType: 'TestCustomer',
          localId: 101,
          cloudUuid: '10000000-0000-0000-0000-000000000101',
          operation: 'CREATE',
          payload: { name: 'TestMig Customer A', phone: '123' }
        }
      ]
    });
    console.log('Result:', res1.data);

    // 2. Duplicate eventUuid (Idempotency)
    console.log('\nTest 2: Duplicate eventUuid');
    const res2 = await sendBatch({
      migrationId: 'test-mig-1',
      batchId: 2,
      payloads: [
        {
          eventUuid: '11111111-1111-1111-1111-111111111111',
          deviceId: 'TEST-1',
          entityType: 'TestCustomer',
          localId: 101,
          cloudUuid: '10000000-0000-0000-0000-000000000101',
          operation: 'CREATE',
          payload: { name: 'TestMig Customer A', phone: '123' }
        }
      ]
    });
    console.log('Result:', res2.data);
    if (res2.data.recordsSkipped !== 1) console.error('FAILED: Should have skipped duplicate eventUuid.');

    // 3. Rollback Failure (Malformed entityType)
    console.log('\nTest 3: Transaction Rollback (Malformed mid-batch)');
    const res3 = await sendBatch({
      migrationId: 'test-mig-1',
      batchId: 3,
      payloads: [
        {
          eventUuid: '22222222-2222-2222-2222-222222222222',
          deviceId: 'TEST-1',
          entityType: 'TestCustomer',
          localId: 102,
          cloudUuid: '10000000-0000-0000-0000-000000000102',
          operation: 'CREATE',
          payload: { name: 'TestMig Customer B' }
        },
        {
          eventUuid: '33333333-3333-3333-3333-333333333333',
          deviceId: 'TEST-1',
          entityType: 'InvalidEntity', // THIS WILL FAIL
          localId: 103,
          cloudUuid: '10000000-0000-0000-0000-000000000103',
          operation: 'CREATE',
          payload: { name: 'Fail' }
        }
      ]
    });
    console.log('Result:', res3.data);
    
    // 4. Verify Rollback
    console.log('\nTest 4: Verify Rollback');
    const rollCheck = await pool.query("SELECT * FROM customers WHERE name = 'TestMig Customer B'");
    console.log(`TestMig Customer B count: ${rollCheck.rowCount} (Expected 0)`);
    if (rollCheck.rowCount !== 0) console.error('FAILED: Transaction rollback did not work.');

    // 5. Auth Failure
    console.log('\nTest 5: Auth Failure');
    const resAuth = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // No auth header
      body: JSON.stringify({ migrationId: 'fail', batchId: 1, payloads: [] })
    });
    console.log(`Status: ${resAuth.status} (Expected 401 or 403)`);

    // Clean up Test Data
    console.log('\nCleaning up all synthetic test data...');
    const cleanup = await pool.query("DELETE FROM customers WHERE name LIKE 'TestMig%'");
    await pool.query("DELETE FROM idempotency_log WHERE event_uuid = '11111111-1111-1111-1111-111111111111'");
    await pool.query("DELETE FROM idempotency_log WHERE event_uuid = '22222222-2222-2222-2222-222222222222'");
    console.log(`Deleted ${cleanup.rowCount} test records.`);
    
    // Final check
    const finalCustomers = await pool.query("SELECT count(*) FROM customers");
    console.log(`\nFinal Real Customer Count in Neon: ${finalCustomers.rows[0].count} (Expected 0)`);

  } catch (error: any) {
    console.error('Test script error:', error);
  } finally {
    pool.end();
  }
}

runTests();
