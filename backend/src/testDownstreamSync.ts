/**
 * Phase 5D — Controlled Downstream Sync Test
 *
 * Simulates two devices: DEVICE-A (this machine's real deviceId) and DEVICE-B (simulated).
 * Tests: CREATE flow, idempotency, self-exclusion, conflict strategy, crash recovery.
 *
 * Run while backend is running: $env:SYNC_INTERNAL_SECRET="test-secret"; npx ts-node src/testDownstreamSync.ts
 */
import { prisma } from './config/database';
import { getNeonPool } from './config/neonDb';
import { getDeviceId } from './utils/deviceId';
import { processDownstreamSync } from './workers/downstreamSyncWorker';
import axios from 'axios';
import crypto from 'crypto';

const DEVICE_A = getDeviceId();
const DEVICE_B = 'DEVICE-B-TEST-' + crypto.randomBytes(4).toString('hex');
const SECRET = process.env.SYNC_INTERNAL_SECRET || 'test-secret';
const API_BASE = process.env.SYNC_API_URL
  ? process.env.SYNC_API_URL.replace('/batch', '')
  : 'http://localhost:5000/api/sync';

const pass = (msg: string) => console.log('  ✅', msg);
const fail = (msg: string) => console.log('  ❌', msg);
const sep = () => console.log('\n' + '─'.repeat(60));

function headers() {
  return { 'x-sync-secret': SECRET };
}

// -----------------------------------------------------------------------
// Helpers to simulate Device B pushing to Neon directly
// -----------------------------------------------------------------------
async function pushDeviceBEvent(
  entityType: string,
  cloudUuid: string,
  operation: string,
  payload: Record<string, any>
): Promise<void> {
  // Device B goes through the upstream API as if it were a real device
  const eventUuid = crypto.randomUUID();
  await axios.post(`${API_BASE}/batch`, {
    batchId: crypto.randomUUID(),
    payloads: [{
      eventUuid,
      cloudUuid,
      entityType,
      deviceId: DEVICE_B,
      localId: Math.floor(Math.random() * 90000) + 10000,
      operation,
      payload: JSON.stringify(payload)
    }]
  }, { headers: headers() });
}

// -----------------------------------------------------------------------
async function getSQLiteBaseline() {
  const [sales, customers] = await Promise.all([
    prisma.sale.aggregate({ _sum: { totalAmount: true } }),
    prisma.customer.count(),
  ]);
  return { salesTotal: sales._sum.totalAmount || 0, customerCount: customers };
}

async function getNeonBaseline(neonClient: any) {
  const [sales, customers] = await Promise.all([
    neonClient.query('SELECT COUNT(*) FROM sales'),
    neonClient.query('SELECT COUNT(*) FROM customers'),
  ]);
  return {
    salesCount: parseInt(sales.rows[0].count, 10),
    customerCount: parseInt(customers.rows[0].count, 10),
  };
}

// -----------------------------------------------------------------------
async function runTests() {
  console.log('═'.repeat(60));
  console.log(' PHASE 5D — DOWNSTREAM SYNC TEST HARNESS');
  console.log('═'.repeat(60));
  console.log(`  Device A (local): ${DEVICE_A}`);
  console.log(`  Device B (simulated): ${DEVICE_B}`);

  const pool = getNeonPool();
  const neonClient = await pool.connect();

  const sqliteBefore = await getSQLiteBaseline();
  const neonBefore = await getNeonBaseline(neonClient);
  console.log(`\n  SQLite Before: customers=${sqliteBefore.customerCount}, salesTotal=${sqliteBefore.salesTotal}`);
  console.log(`  Neon Before:   customers=${neonBefore.customerCount}, sales=${neonBefore.salesCount}`);

  const createdCloudUuids: string[] = [];
  const createdSQLiteIds: number[] = [];

  try {
    // ═══ TEST 1: Device B creates a Customer — Device A should receive it ════
    sep();
    console.log('TEST 1: Device B creates a Customer → Device A downloads it');

    const deviceBCustomerUuid = crypto.randomUUID();
    await pushDeviceBEvent('Customer', deviceBCustomerUuid, 'CREATE', {
      name: 'Device B Test Customer',
      phone: '0300-5551234',
      customer_type: 'retail',
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    createdCloudUuids.push(deviceBCustomerUuid);

    // Reset downstream state to force re-pull from just before Device B's event
    const csRes = await neonClient.query(
      'SELECT change_sequence FROM cloud_sync_events WHERE event_uuid = (SELECT event_uuid FROM cloud_sync_events ORDER BY change_sequence DESC LIMIT 1)'
    );
    const deviceBSeq = BigInt(csRes.rows[0]?.change_sequence ?? '0');

    // Set cursor to one before Device B's event
    await prisma.downstreamSyncState.upsert({
      where: { id: 1 },
      update: { lastCursor: deviceBSeq - 1n },
      create: { id: 1, lastCursor: deviceBSeq - 1n }
    });

    // Run downstream sync
    await processDownstreamSync();

    // Verify Device B's customer landed in local SQLite
    const localCustomer = await prisma.localToCloudMapping.findFirst({
      where: { cloudUuid: deviceBCustomerUuid }
    });
    if (localCustomer) {
      pass(`Customer from Device B found in SQLite with localId=${localCustomer.localId}`);
      createdSQLiteIds.push(localCustomer.localId);
      const cust = await prisma.customer.findUnique({ where: { id: localCustomer.localId } });
      if (cust?.name === 'Device B Test Customer') pass('Name matches');
      else fail(`Name mismatch: ${cust?.name}`);
    } else {
      fail('Customer from Device B NOT found in local SQLite');
    }

    // ═══ TEST 2: Idempotency — run sync again, should not duplicate ═══
    sep();
    console.log('TEST 2: Idempotency — run downstream sync again');
    await processDownstreamSync();
    const duplicateCustomers = await prisma.customer.findMany({
      where: { name: 'Device B Test Customer' }
    });
    if (duplicateCustomers.length === 1) {
      pass(`No duplicate — exactly 1 record in SQLite`);
    } else {
      fail(`Duplicate detected! Found ${duplicateCustomers.length} records`);
    }

    // ═══ TEST 3: Self-exclusion — Device A's own events must not be pulled back ═══
    sep();
    console.log("TEST 3: Self-exclusion — Device A's own events not returned");

    // Device A creates and pushes a customer
    const deviceACustomerUuid = crypto.randomUUID();
    await axios.post(`${API_BASE}/batch`, {
      batchId: crypto.randomUUID(),
      payloads: [{
        eventUuid: crypto.randomUUID(),
        cloudUuid: deviceACustomerUuid,
        entityType: 'Customer',
        deviceId: DEVICE_A,
        localId: 99998,
        operation: 'CREATE',
        payload: JSON.stringify({ name: 'Device A Own Customer', customer_type: 'retail', status: 'active' })
      }]
    }, { headers: headers() });
    createdCloudUuids.push(deviceACustomerUuid);

    const countBefore = await prisma.customer.count();
    const dsStateBefore = await prisma.downstreamSyncState.findUnique({ where: { id: 1 } });

    // Move cursor back to ensure Device A's event is in range
    const csRes2 = await neonClient.query(
      `SELECT change_sequence FROM cloud_sync_events WHERE cloud_uuid = $1`,
      [deviceACustomerUuid]
    );
    const deviceASeq = BigInt(csRes2.rows[0]?.change_sequence ?? '0');
    await prisma.downstreamSyncState.update({
      where: { id: 1 },
      data: { lastCursor: deviceASeq - 1n }
    });

    await processDownstreamSync();

    const countAfter = await prisma.customer.count();
    if (countAfter === countBefore) {
      pass("Device A's own event NOT applied locally (self-exclusion working)");
    } else {
      fail(`Self-exclusion FAILED — customer count changed from ${countBefore} to ${countAfter}`);
    }

    // ═══ TEST 4: Conflict — Device B updates same Customer ═══
    sep();
    console.log('TEST 4: Conflict handling — Device B updates same Customer');

    const localMapping = await prisma.localToCloudMapping.findFirst({
      where: { cloudUuid: deviceBCustomerUuid }
    });

    if (localMapping) {
      // Change local record first (simulating offline edit by Device A)
      await prisma.customer.update({
        where: { id: localMapping.localId },
        data: { phone: '0300-LOCALCHANGE' }
      });

      // Device B pushes an update to same customer
      await pushDeviceBEvent('Customer', deviceBCustomerUuid, 'UPDATE', {
        name: 'Device B Test Customer UPDATED',
        phone: '0300-CLOUDCHANGE',
        customer_type: 'retail',
        status: 'active',
      });

      // Advance cursor to just before Device B's update
      const csRes3 = await neonClient.query(
        `SELECT change_sequence FROM cloud_sync_events WHERE cloud_uuid = $1 ORDER BY change_sequence DESC LIMIT 1`,
        [deviceBCustomerUuid]
      );
      const updateSeq = BigInt(csRes3.rows[0]?.change_sequence ?? '0');
      await prisma.downstreamSyncState.update({
        where: { id: 1 },
        data: { lastCursor: updateSeq - 1n }
      });

      await processDownstreamSync();

      const updatedCust = await prisma.customer.findUnique({ where: { id: localMapping.localId } });
      // Cloud wins strategy for master data
      if (updatedCust?.name === 'Device B Test Customer UPDATED') {
        pass('UPDATE applied — cloud name wins for master data');
      } else {
        fail(`UPDATE not applied. Current name: ${updatedCust?.name}`);
      }
    } else {
      fail('Could not test conflict — local mapping not found');
    }

    // ═══ TEST 5: Transaction Delete Protection ═══
    sep();
    console.log('TEST 5: Transaction DELETE protection — Sale DELETE must be skipped');

    const deviceBSaleUuid = crypto.randomUUID();
    // First create a Sale from Device B
    await pushDeviceBEvent('Sale', deviceBSaleUuid, 'CREATE', {
      sale_type: 'walk_in',
      total_amount: 500,
      paid_amount: 500,
      remaining_balance: 0,
      status: 'paid',
    });
    createdCloudUuids.push(deviceBSaleUuid);

    // Pull the Sale downstream
    const csRes4 = await neonClient.query(
      `SELECT change_sequence FROM cloud_sync_events WHERE cloud_uuid = $1`,
      [deviceBSaleUuid]
    );
    const saleSeq = BigInt(csRes4.rows[0]?.change_sequence ?? '0');
    await prisma.downstreamSyncState.update({
      where: { id: 1 },
      data: { lastCursor: saleSeq - 1n }
    });
    await processDownstreamSync();

    const saleMapping = await prisma.localToCloudMapping.findFirst({ where: { cloudUuid: deviceBSaleUuid } });

    // Now Device B issues a DELETE
    await pushDeviceBEvent('Sale', deviceBSaleUuid, 'DELETE', {});

    // Pull DELETE downstream
    const csRes5 = await neonClient.query(
      `SELECT change_sequence FROM cloud_sync_events WHERE cloud_uuid = $1 ORDER BY change_sequence DESC LIMIT 1`,
      [deviceBSaleUuid]
    );
    const deleteSeq = BigInt(csRes5.rows[0]?.change_sequence ?? '0');
    await prisma.downstreamSyncState.update({
      where: { id: 1 },
      data: { lastCursor: deleteSeq - 1n }
    });
    await processDownstreamSync();

    if (saleMapping) {
      createdSQLiteIds.push(saleMapping.localId); // Mark for cleanup
      const localSale = await prisma.sale.findUnique({ where: { id: saleMapping.localId } });
      if (localSale) {
        pass('Sale still exists locally — DELETE protected for financial transactions');
      } else {
        fail('Sale was DELETED locally — financial protection FAILED');
      }
    } else {
      console.log('  ℹ️  Sale was not synced downstream (may have failed mapping) — DELETE test inconclusive');
    }

    // ═══ TEST 6: Crash Recovery — cursor stability ═══
    sep();
    console.log('TEST 6: Crash Recovery — cursor not advanced on failed application');

    const stateBeforeCrash = await prisma.downstreamSyncState.findUnique({ where: { id: 1 } });
    const cursorBefore = stateBeforeCrash?.lastCursor;

    // Push a malformed event (will fail in applyCreate due to invalid entityType)
    const badUuid = crypto.randomUUID();
    await neonClient.query(
      `INSERT INTO cloud_sync_events (event_uuid, device_id, entity_type, cloud_uuid, operation, payload)
       VALUES($1, $2, 'NonExistentEntity', $3, 'CREATE', '{}')`,
      [crypto.randomUUID(), DEVICE_B, badUuid]
    );

    const badSeq = await neonClient.query(
      `SELECT change_sequence FROM cloud_sync_events WHERE cloud_uuid = $1`, [badUuid]
    );
    const badSeqNum = BigInt(badSeq.rows[0]?.change_sequence ?? '0');
    await prisma.downstreamSyncState.update({
      where: { id: 1 },
      data: { lastCursor: badSeqNum - 1n }
    });

    await processDownstreamSync();

    const stateAfterCrash = await prisma.downstreamSyncState.findUnique({ where: { id: 1 } });
    const cursorAfter = stateAfterCrash?.lastCursor;

    // Cursor should not advance past the failed event
    if (cursorAfter !== undefined && cursorAfter < badSeqNum) {
      pass(`Cursor stopped at ${cursorAfter} — did not advance past failed event ${badSeqNum}`);
    } else {
      fail(`Cursor advanced to ${cursorAfter} despite failure — crash recovery issue`);
    }



  } finally {
    // ─── CLEANUP ────────────────────────────────────────────────────────────
    sep();
    console.log('CLEANUP');

    // Remove test data from Neon
    for (const uuid of createdCloudUuids) {
      await neonClient.query(`DELETE FROM idempotency_log WHERE event_uuid IN (
        SELECT event_uuid FROM cloud_sync_events WHERE cloud_uuid = $1
      )`, [uuid]).catch(() => {});
    }
    // Clean cloud_sync_events for Device B
    await neonClient.query(`DELETE FROM cloud_sync_events WHERE device_id = $1`, [DEVICE_B]).catch(() => {});
    await neonClient.query(`DELETE FROM sales WHERE device_id = $1`, [DEVICE_B]).catch(() => {});
    await neonClient.query(`DELETE FROM customers WHERE device_id IN ($1, $2)`, [DEVICE_A, DEVICE_B]).catch(() => {});
    await neonClient.query(`DELETE FROM idempotency_log WHERE device_id IN ($1, $2)`, [DEVICE_A, DEVICE_B]).catch(() => {});

    // Remove test records from SQLite
    for (const localId of createdSQLiteIds) {
      await prisma.customer.deleteMany({ where: { id: localId } }).catch(() => {});
      await prisma.sale.deleteMany({ where: { id: localId } }).catch(() => {});
    }
    await prisma.customer.deleteMany({ where: { name: { contains: 'Device B Test Customer' } } }).catch(() => {});
    await prisma.customer.deleteMany({ where: { name: { contains: 'Device A Own Customer' } } }).catch(() => {});
    await prisma.localToCloudMapping.deleteMany({ where: { cloudUuid: { in: createdCloudUuids } } }).catch(() => {});
    await prisma.downstreamAppliedEvent.deleteMany({ where: { changeSequence: { gte: 1n } } }).catch(() => {});

    // Reset cursor
    await prisma.downstreamSyncState.deleteMany({}).catch(() => {});

    // ═══ FINAL BASELINE VERIFICATION ═══
    console.log('\nFINAL: Baseline verification');
    const sqliteAfter = await getSQLiteBaseline();
    const neonAfter = await getNeonBaseline(neonClient);
    
    console.log(`  SQLite Before: customers=${sqliteBefore.customerCount}, salesTotal=${sqliteBefore.salesTotal}`);
    console.log(`  SQLite After:  customers=${sqliteAfter.customerCount}, salesTotal=${sqliteAfter.salesTotal}`);
    console.log(`  Neon Before:   customers=${neonBefore.customerCount}, sales=${neonBefore.salesCount}`);
    console.log(`  Neon After:    customers=${neonAfter.customerCount}, sales=${neonAfter.salesCount}`);

    if (sqliteAfter.salesTotal === sqliteBefore.salesTotal) {
      pass('Financial totals (salesTotal) unchanged — baseline preserved');
    } else {
      fail(`Sales total changed: ${sqliteBefore.salesTotal} → ${sqliteAfter.salesTotal}`);
    }

    neonClient.release();
    console.log('  Cleanup complete.');
    sep();
  }
}

runTests()
  .then(() => prisma.$disconnect())
  .catch(err => { console.error(err); prisma.$disconnect(); });
