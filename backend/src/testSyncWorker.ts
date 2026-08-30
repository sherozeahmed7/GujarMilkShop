import { prisma } from './config/database';
import { getNeonPool } from './config/neonDb';
import { processSyncQueue } from './workers/syncWorker';
import { SyncQueueService } from './services/syncQueue.service';
import crypto from 'crypto';
import axios from 'axios';

// Ensure the tests run against the correct endpoint
process.env.SYNC_INTERNAL_SECRET = 'test-secret';
process.env.SYNC_API_URL = 'http://localhost:5000/api/sync/batch';

const money = (val: number) => Math.round(val * 100) / 100;

async function getSQLiteFinancials() {
  const [sales, payments, movements] = await Promise.all([
    prisma.sale.aggregate({ _sum: { totalAmount: true } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
    prisma.inventoryMovement.count(),
  ]);
  return {
    salesTotal: sales._sum.totalAmount || 0,
    paymentsTotal: payments._sum.amount || 0,
    inventoryMovements: movements,
  };
}

async function getNeonCount() {
  const pool = getNeonPool();
  const client = await pool.connect();
  try {
    const counts = await Promise.all([
      client.query('SELECT COUNT(*) FROM sales'),
      client.query('SELECT COUNT(*) FROM customers'),
    ]);
    return {
      sales: parseInt(counts[0].rows[0].count, 10),
      customers: parseInt(counts[1].rows[0].count, 10),
    };
  } finally {
    client.release();
  }
}

async function runTests() {
  console.log('--- PHASE 5C TEST HARNESS ---');

  // 1. Verify Before Baseline
  const sqliteBefore = await getSQLiteFinancials();
  const neonBefore = await getNeonCount();
  console.log('SQLite Before:', sqliteBefore);
  console.log('Neon Before:', neonBefore);

  // 2. Test complete flow: Customer -> Sale -> SaleItem -> Payment
  console.log('\n>> TEST: Normal CREATE Flow with Dependencies');
  const testPhone = '9999999999';
  
  // Create business records atomically
  const result = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.create({
      data: { name: 'Test Sync Customer', phone: testPhone, customerType: 'retail' }
    });
    const customerCloudUuid = await SyncQueueService.enqueueCreate(tx, 'Customer', customer.id, customer, 0);

    const sale = await tx.sale.create({
      data: {
        saleType: 'khata',
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        totalAmount: 100,
        paidAmount: 50,
        remainingBalance: 50,
        status: 'partial'
      }
    });
    const saleCloudUuid = await SyncQueueService.enqueueCreate(tx, 'Sale', sale.id, { ...sale, customer_uuid: customerCloudUuid }, 1);

    const saleItem = await tx.saleItem.create({
      data: {
        saleId: sale.id,
        itemName: 'Test Milk',
        quantity: 1,
        unitPrice: 100,
        totalPrice: 100,
      }
    });
    const itemCloudUuid = await SyncQueueService.enqueueCreate(tx, 'SaleItem', saleItem.id, { ...saleItem, sale_uuid: saleCloudUuid }, 2);

    const payment = await tx.payment.create({
      data: {
        saleId: sale.id,
        method: 'cash',
        amount: 50,
        status: 'completed'
      }
    });
    const paymentCloudUuid = await SyncQueueService.enqueueCreate(tx, 'Payment', payment.id, { ...payment, sale_uuid: saleCloudUuid }, 2);

    return { customer, sale, saleItem, payment, customerCloudUuid, saleCloudUuid, itemCloudUuid, paymentCloudUuid };
  });

  console.log('Created local test records & queue events.');

  // 3. Process SyncQueue manually
  console.log('Running SyncWorker...');
  await processSyncQueue();

  // 4. Verify SyncQueue state
  const pending = await prisma.syncQueue.count({ where: { status: 'PENDING' } });
  const synced = await prisma.syncQueue.count({ where: { status: 'SYNCED' } });
  const failed = await prisma.syncQueue.count({ where: { status: 'FAILED' } });
  console.log(`SyncQueue Status -> PENDING: ${pending}, SYNCED: ${synced}, FAILED: ${failed}`);

  // 5. Verify Neon state
  const neonAfterSync = await getNeonCount();
  console.log(`Neon Customers: ${neonBefore.customers} -> ${neonAfterSync.customers}`);
  console.log(`Neon Sales: ${neonBefore.sales} -> ${neonAfterSync.sales}`);

  // 6. Idempotency Test
  console.log('\n>> TEST: Idempotency');
  // Re-send the exact same Customer event to the API directly
  const customerEvent = await prisma.syncQueue.findFirst({ where: { entityType: 'Customer', status: 'SYNCED', cloudUuid: result.customerCloudUuid } });
  if (customerEvent) {
    const payload = {
      eventUuid: customerEvent.eventUuid,
      cloudUuid: customerEvent.cloudUuid,
      entityType: customerEvent.entityType,
      deviceId: customerEvent.deviceId,
      localId: customerEvent.localId,
      operation: customerEvent.operation,
      payload: customerEvent.payload
    };
    const response = await axios.post(process.env.SYNC_API_URL!, {
      batchId: crypto.randomUUID(),
      payloads: [payload]
    }, { headers: { 'x-sync-secret': process.env.SYNC_INTERNAL_SECRET! } });
    
    console.log('Idempotency API Response:', response.data.results[0]);
    const neonIdempotentCount = await getNeonCount();
    console.log(`Neon Customers after idempotent request: ${neonIdempotentCount.customers} (should be same)`);
  }

  // 7. Network Failure Test (simulate by changing API URL)
  console.log('\n>> TEST: Network Failure & Retry');
  const oldUrl = process.env.SYNC_API_URL;
  process.env.SYNC_API_URL = 'http://localhost:9999/api/sync/batch'; // intentionally broken
  
  const dummyEvent = await prisma.syncQueue.create({
    data: {
      eventUuid: crypto.randomUUID(),
      deviceId: 'test-device',
      entityType: 'User',
      localId: 9999,
      cloudUuid: crypto.randomUUID(),
      operation: 'CREATE',
      payload: '{}',
      status: 'PENDING',
      layer: 0
    }
  });

  await processSyncQueue();
  const retryEvent = await prisma.syncQueue.findUnique({ where: { eventUuid: dummyEvent.eventUuid } });
  console.log('Network Failure Event Status:', retryEvent?.status);
  console.log('Retry Count:', retryEvent?.retryCount);
  console.log('Next Retry At:', retryEvent?.nextRetryAt);
  
  process.env.SYNC_API_URL = oldUrl; // restore

  // 8. Permanent Failure Test
  console.log('\n>> TEST: Permanent Failure');
  const invalidEvent = await prisma.syncQueue.create({
    data: {
      eventUuid: crypto.randomUUID(),
      deviceId: 'test-device',
      entityType: 'Sale', // missing required fields will cause 400 or db error
      localId: 9998,
      cloudUuid: crypto.randomUUID(),
      operation: 'CREATE',
      payload: '{"invalid": "yes"}',
      status: 'PENDING',
      layer: 1
    }
  });

  await processSyncQueue();
  const permFailEvent = await prisma.syncQueue.findUnique({ where: { eventUuid: invalidEvent.eventUuid } });
  console.log('Permanent Failure Event Status:', permFailEvent?.status);
  console.log('Permanent Failure Error:', permFailEvent?.error);

  // 9. Crash Recovery (Stale SYNCING)
  console.log('\n>> TEST: Crash Recovery');
  const staleEvent = await prisma.syncQueue.create({
    data: {
      eventUuid: crypto.randomUUID(),
      deviceId: 'test-device',
      entityType: 'User',
      localId: 9997,
      cloudUuid: crypto.randomUUID(),
      operation: 'CREATE',
      payload: '{}',
      status: 'SYNCING',
      layer: 0,
      updatedAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
    }
  });

  await processSyncQueue(); // this runs the stale recovery before normal processing, but since it's an invalid user, it will fail permanently afterwards, or network fail since payload is empty? Actually, processSyncQueue will pick it up and process it.
  const recoveredEvent = await prisma.syncQueue.findUnique({ where: { eventUuid: staleEvent.eventUuid } });
  console.log('Stale Event new Status (recovered and processed):', recoveredEvent?.status);

  // 10. Clean up test records
  console.log('\n>> CLEANING UP TEST DATA');
  
  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id: result.payment.id } });
    await tx.saleItem.delete({ where: { id: result.saleItem.id } });
    await tx.sale.delete({ where: { id: result.sale.id } });
    await tx.customer.delete({ where: { id: result.customer.id } });
    
    // delete test events
    await tx.syncQueue.deleteMany({
      where: {
        eventUuid: { in: [dummyEvent.eventUuid, invalidEvent.eventUuid, staleEvent.eventUuid] }
      }
    });
    // clear all synced events generated by test
    await tx.syncQueue.deleteMany({
      where: { status: 'SYNCED', createdAt: { gt: new Date(Date.now() - 60000) } }
    });
    
    await tx.localToCloudMapping.deleteMany({
      where: { cloudUuid: { in: [result.customerCloudUuid, result.saleCloudUuid, result.itemCloudUuid, result.paymentCloudUuid] } }
    });
  });

  // Clean Neon
  const pool = getNeonPool();
  const client = await pool.connect();
  try {
    await client.query(`DELETE FROM payments WHERE id=$1`, [result.paymentCloudUuid]);
    await client.query(`DELETE FROM sale_items WHERE id=$1`, [result.itemCloudUuid]);
    await client.query(`DELETE FROM sales WHERE id=$1`, [result.saleCloudUuid]);
    await client.query(`DELETE FROM customers WHERE id=$1`, [result.customerCloudUuid]);
    await client.query(`DELETE FROM idempotency_log WHERE event_uuid IN ($1, $2, $3, $4)`, 
      [
        (await prisma.syncQueue.findFirst({ where: { cloudUuid: result.customerCloudUuid } }))?.eventUuid,
        (await prisma.syncQueue.findFirst({ where: { cloudUuid: result.saleCloudUuid } }))?.eventUuid,
        (await prisma.syncQueue.findFirst({ where: { cloudUuid: result.itemCloudUuid } }))?.eventUuid,
        (await prisma.syncQueue.findFirst({ where: { cloudUuid: result.paymentCloudUuid } }))?.eventUuid
      ].filter(Boolean)
    );
  } catch (e: any) {
    console.error('Neon cleanup error:', e.message);
  } finally {
    client.release();
  }

  // 11. Final Validation
  const sqliteAfter = await getSQLiteFinancials();
  const neonAfter = await getNeonCount();
  console.log('\nSQLite After:', sqliteAfter);
  console.log('Neon After:', neonAfter);
  
  if (JSON.stringify(sqliteBefore) === JSON.stringify(sqliteAfter) && neonBefore.sales === neonAfter.sales && neonBefore.customers === neonAfter.customers) {
    console.log('✅ BASELINE AND FINANCIALS PRESERVED CORRECTLY.');
  } else {
    console.error('❌ BASELINE DISCREPANCY DETECTED.');
  }
}

runTests().then(() => prisma.$disconnect()).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
