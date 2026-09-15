import 'dotenv/config';
import { syncBatch } from './src/controllers/syncBatch.controller';
import { getNeonPool } from './src/config/neonDb';
import { randomUUID as uuidv4 } from 'crypto';

async function runTests() {
  const pool = getNeonPool();
  
  // Helper to call syncBatch
  async function callSync(payloads: any[]) {
    let resData: any;
    let resStatus: number = 200;
    const req = { body: { batchId: uuidv4(), payloads } } as any;
    const res = {
      status: (s: number) => { resStatus = s; return res; },
      json: (d: any) => { resData = d; }
    } as any;
    
    await syncBatch(req, res);
    if (resStatus !== 200) throw new Error(JSON.stringify(resData));
    return resData;
  }

  const deviceId = 'test_dev_' + Math.floor(Math.random() * 1000);
  console.log(`Starting concurrency tests for device: ${deviceId}`);

  try {
    // -----------------------------------------------------------------------------------
    // Test C: Same eventUuid concurrently delivered 3+ times
    // -----------------------------------------------------------------------------------
    console.log('\n--- Test C: Same eventUuid concurrently delivered 3 times ---');
    const eventIdC = uuidv4();
    const cloudIdC = uuidv4();
    const payloadC = {
      eventUuid: eventIdC,
      cloudUuid: cloudIdC,
      entityType: 'Customer',
      deviceId,
      localId: 999,
      operation: 'CREATE',
      payload: { name: 'Concurrent Cust', phone: '123' }
    };

    const resultsC = await Promise.all([
      callSync([payloadC]),
      callSync([payloadC]),
      callSync([payloadC])
    ]);
    
    console.log('Results (should all be SYNCED):', resultsC.map(r => r.results[0].status));
    
    const countRes = await pool.query(`SELECT COUNT(*) FROM customers WHERE id=$1`, [cloudIdC]);
    console.log('Customer Count in DB (should be 1):', countRes.rows[0].count);


    // -----------------------------------------------------------------------------------
    // Test D: Two different events concurrently creating the same logical Shift
    // -----------------------------------------------------------------------------------
    console.log('\n--- Test D: Two different events concurrently creating same logical Shift ---');
    const shiftDate = '2026-09-14';
    const payloadD1 = {
      eventUuid: uuidv4(),
      cloudUuid: uuidv4(),
      entityType: 'Shift',
      deviceId,
      localId: 101,
      operation: 'CREATE',
      payload: { shiftDate, openedByUuid: null, openedAt: new Date().toISOString(), openingCash: 100, status: 'Open' }
    };
    const payloadD2 = {
      eventUuid: uuidv4(),
      cloudUuid: uuidv4(),
      entityType: 'Shift',
      deviceId,
      localId: 102, // different local ID! (race condition split-brain)
      operation: 'CREATE',
      payload: { shiftDate, openedByUuid: null, openedAt: new Date().toISOString(), openingCash: 100, status: 'Open' }
    };

    const resultsD = await Promise.all([
      callSync([payloadD1]),
      callSync([payloadD2])
    ]);
    
    const rD1 = resultsD[0].results[0];
    const rD2 = resultsD[1].results[0];
    console.log('Status 1:', rD1.status, 'Resolved UUID 1:', rD1.resolvedUuid);
    console.log('Status 2:', rD2.status, 'Resolved UUID 2:', rD2.resolvedUuid);
    
    if (rD1.resolvedUuid === rD2.resolvedUuid && rD1.resolvedUuid) {
      console.log('SUCCESS: Both events resolved to the same Shift UUID!');
    } else {
      console.error('FAILURE: Events resolved to different UUIDs or failed.');
    }
    
    const shiftCountRes = await pool.query(`SELECT COUNT(*) FROM shifts WHERE device_id=$1 AND shift_date=$2`, [deviceId, shiftDate]);
    console.log('Shift Count in DB (should be 1):', shiftCountRes.rows[0].count);


    // -----------------------------------------------------------------------------------
    // Test E: Two different events concurrently creating same InventoryProduct
    // -----------------------------------------------------------------------------------
    console.log('\n--- Test E: Two different events concurrently creating same InventoryProduct ---');
    const prodCode = `TEST_PROD_${deviceId}`;
    const payloadE1 = {
      eventUuid: uuidv4(),
      cloudUuid: uuidv4(),
      entityType: 'InventoryProduct',
      deviceId,
      localId: 201,
      operation: 'CREATE',
      payload: { code: prodCode, name: 'Prod A', unit: 'kg' }
    };
    const payloadE2 = {
      eventUuid: uuidv4(),
      cloudUuid: uuidv4(),
      entityType: 'InventoryProduct',
      deviceId,
      localId: 201, // same local ID, different cloud UUID
      operation: 'CREATE',
      payload: { code: prodCode, name: 'Prod B', unit: 'kg' }
    };

    const resultsE = await Promise.all([
      callSync([payloadE1]),
      callSync([payloadE2])
    ]);
    
    const rE1 = resultsE[0].results[0];
    const rE2 = resultsE[1].results[0];
    console.log('Status 1:', rE1.status, 'Resolved UUID 1:', rE1.resolvedUuid);
    console.log('Status 2:', rE2.status, 'Resolved UUID 2:', rE2.resolvedUuid);
    
    if (rE1.resolvedUuid === rE2.resolvedUuid && rE1.resolvedUuid) {
      console.log('SUCCESS: Both events resolved to the same Product UUID!');
    } else {
      console.error('FAILURE: Events resolved to different UUIDs or failed.');
    }
    
    const prodCountRes = await pool.query(`SELECT COUNT(*) FROM inventory_products WHERE code=$1`, [prodCode]);
    console.log('Product Count in DB (should be 1):', prodCountRes.rows[0].count);


    // -----------------------------------------------------------------------------------
    // Test A: Existing InventoryProduct UUID A, incoming UUID B with changed code
    // -----------------------------------------------------------------------------------
    console.log('\n--- Test A: Existing Product UUID A, incoming UUID B changed code ---');
    const newCloudUuid = uuidv4();
    const payloadA = {
      eventUuid: uuidv4(),
      cloudUuid: newCloudUuid, // new UUID B
      entityType: 'InventoryProduct',
      deviceId,
      localId: 201, // matches existing E
      operation: 'UPDATE',
      payload: { code: `${prodCode}_MODIFIED`, name: 'Prod B MOD' }
    };
    
    const resA = await callSync([payloadA]);
    const rA = resA.results[0];
    console.log('Status:', rA.status, 'Resolved UUID:', rA.resolvedUuid);
    
    if (rA.resolvedUuid === rE1.resolvedUuid) {
       console.log('SUCCESS: Mapped UUID was preserved despite changing the code!');
    } else {
       console.error(`FAILURE: UUID was not preserved. Expected ${rE1.resolvedUuid}, got ${rA.resolvedUuid}`);
    }


    // -----------------------------------------------------------------------------------
    // Test B: Existing Shift UUID A, incoming UUID B
    // -----------------------------------------------------------------------------------
    console.log('\n--- Test B: Existing Shift UUID A, incoming UUID B ---');
    const shiftPayloadB = {
      eventUuid: uuidv4(),
      cloudUuid: uuidv4(), // new UUID B
      entityType: 'Shift',
      deviceId,
      localId: 105, // new local ID!
      operation: 'CREATE', // another split brain trying to create same shift_date
      payload: { shiftDate, openedByUuid: null, openedAt: new Date().toISOString(), openingCash: 200, status: 'Open' }
    };
    
    const resB = await callSync([shiftPayloadB]);
    const rB = resB.results[0];
    console.log('Status:', rB.status, 'Resolved UUID:', rB.resolvedUuid);
    
    if (rB.resolvedUuid === rD1.resolvedUuid) {
       console.log('SUCCESS: Shift UUID was preserved based on business key (shift_date)!');
    } else {
       console.error(`FAILURE: UUID was not preserved. Expected ${rD1.resolvedUuid}, got ${rB.resolvedUuid}`);
    }

  } catch (err) {
    console.error('Test Execution Failed:', err);
  } finally {
    await pool.end();
  }
}

runTests();
