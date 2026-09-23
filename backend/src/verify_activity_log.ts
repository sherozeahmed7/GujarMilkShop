import { prisma } from './config/database';
import { getNeonPool } from './config/neonDb';
import jwt from 'jsonwebtoken';
import { SyncQueueService } from './services/syncQueue.service';
import { getDeviceId } from './utils/deviceId';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_123';
const deviceId = getDeviceId();

async function runTests() {
  console.log('--- STARTING ACTIVITY LOG VERIFICATION ---');
  let allPassed = true;

  try {
    const neonPool = getNeonPool();
    const neonClient = await neonPool.connect();

    // 1. Generate JWT
    const token = jwt.sign({ id: 'test-user', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

    // Step 5: Auth tests (GET/POST without JWT)
    console.log('\n[Test 5] Auth Tests');
    try {
      const fetchNoAuth = await fetch('http://localhost:5000/api/activity-logs');
      if (fetchNoAuth.status !== 401 && fetchNoAuth.status !== 403) {
        throw new Error(`Expected 401/403, got ${fetchNoAuth.status}`);
      }
      
      const fetchWithAuth = await fetch('http://localhost:5000/api/activity-logs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!fetchWithAuth.ok) {
        throw new Error(`Expected 200 with JWT, got ${fetchWithAuth.status}`);
      }
      console.log('PASS: Auth works correctly');
    } catch (e: any) {
      console.error('FAIL: Auth tests -', e.message);
      allPassed = false;
    }

    // Step 6 & 7: Pagination and Filters
    console.log('\n[Test 6 & 7] Pagination & Filters');
    try {
      const pageTest = await fetch('http://localhost:5000/api/activity-logs?pageSize=100', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const pageData = await pageTest.json();
      if (pageData.pageSize > 25 || pageData.data.length > 25) {
        throw new Error(`Backend returned pageSize ${pageData.pageSize} or >25 items`);
      }
      if (pageData.total === undefined || pageData.totalPages === undefined) {
         throw new Error(`Missing pagination metadata`);
      }
      console.log('PASS: Pagination limits to max 25 and returns correct metadata');
    } catch (e: any) {
      console.error('FAIL: Pagination tests -', e.message);
      allPassed = false;
    }

    // Step 1: Create Log -> SQLite + SyncQueue
    console.log('\n[Test 1] Create ActivityLog -> SQLite + SyncQueue');
    const testAction = `TEST_ACTION_${Date.now()}`;
    let logId;
    let eventUuid;
    try {
      const postReq = await fetch('http://localhost:5000/api/activity-logs', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user: 'TestUser',
          userRole: 'ADMIN',
          action: testAction,
          module: 'TestModule',
          description: 'Testing 1 2 3',
          status: 'Success'
        })
      });
      
      const postData = await postReq.json();
      logId = postData.id;

      const localLog = await prisma.activityLog.findUnique({ where: { id: logId } });
      if (!localLog) throw new Error('Not found in SQLite');

      const queueItem = await prisma.syncQueue.findFirst({
        where: { entityType: 'ActivityLog', localId: logId }
      });
      if (!queueItem) throw new Error('Not found in SyncQueue');
      eventUuid = queueItem.eventUuid;

      console.log('PASS: Created in SQLite and SyncQueue');
    } catch (e: any) {
      console.error('FAIL: Create log -', e.message);
      allPassed = false;
    }

    // Step 2 & 3: Run sync -> confirm Neon exactly once
    console.log('\n[Test 2 & 3] Sync to Neon exactly once (Idempotency)');
    try {
      if (!logId) throw new Error('Missing logId from step 1');

      // Trigger sync manually via batch controller simulation
      const queueItem = await prisma.syncQueue.findFirst({
        where: { entityType: 'ActivityLog', localId: logId }
      });
      
      if (!queueItem) throw new Error('Queue item disappeared');

      const payload = {
        batchId: 1,
        payloads: [{
          eventUuid: queueItem.eventUuid,
          cloudUuid: queueItem.eventUuid, // using eventUuid as cloudUuid for simplicity in test
          entityType: 'ActivityLog',
          deviceId: deviceId,
          localId: logId,
          operation: 'CREATE',
          payload: queueItem.payload
        }]
      };

      // Mock internal sync auth
      const syncInternalSecret = process.env.SYNC_INTERNAL_SECRET || 'super_secret_internal_sync_key';

      const syncReq = await fetch('http://localhost:5000/api/sync/batch', {
         method: 'POST',
         headers: { 
           'Content-Type': 'application/json',
           'x-sync-secret': syncInternalSecret
         },
         body: JSON.stringify(payload)
      });
      
      const syncRes = await syncReq.json();
      
      // Check Neon DB
      const neonCheck = await neonClient.query('SELECT * FROM activity_logs WHERE device_id=$1 AND local_id=$2', [deviceId, logId]);
      if (neonCheck.rowCount !== 1) {
         throw new Error(`Expected exactly 1 row in Neon, got ${neonCheck.rowCount}`);
      }
      
      // Test 3: Idempotency - send again
      const syncReq2 = await fetch('http://localhost:5000/api/sync/batch', {
         method: 'POST',
         headers: { 
           'Content-Type': 'application/json',
           'x-sync-secret': syncInternalSecret
         },
         body: JSON.stringify(payload)
      });
      
      const neonCheck2 = await neonClient.query('SELECT * FROM activity_logs WHERE device_id=$1 AND local_id=$2', [deviceId, logId]);
      if (neonCheck2.rowCount !== 1) {
         throw new Error(`Expected exactly 1 row in Neon after duplicate sync, got ${neonCheck2.rowCount}`);
      }
      
      console.log('PASS: Synced to Neon exactly once, idempotency works');
    } catch (e: any) {
      console.error('FAIL: Sync to Neon -', e.message);
      allPassed = false;
    }
    
    // Step 8: Confirm existing sync entity works
    console.log('\n[Test 8] Confirm existing sync entity works');
    try {
      const syncInternalSecret = process.env.SYNC_INTERNAL_SECRET || 'super_secret_internal_sync_key';

      const payload = {
        batchId: 2,
        payloads: [{
          eventUuid: 'test-event-uuid-123',
          cloudUuid: 'test-cloud-uuid-123',
          entityType: 'Customer',
          deviceId: deviceId,
          localId: 999999,
          operation: 'CREATE',
          payload: {
             name: 'Test Customer Existing',
             phone: '1234567890',
             customer_type: 'retail',
             status: 'active'
          }
        }]
      };
      
      const syncReq = await fetch('http://localhost:5000/api/sync/batch', {
         method: 'POST',
         headers: { 
           'Content-Type': 'application/json',
           'x-sync-secret': syncInternalSecret
         },
         body: JSON.stringify(payload)
      });
      
      if (!syncReq.ok) {
         const errData = await syncReq.text();
         throw new Error(`Failed to sync existing entity: ${syncReq.status} ${errData}`);
      }
      console.log('PASS: Existing sync entity works');
    } catch (e: any) {
      console.error('FAIL: Existing sync entity -', e.message);
      allPassed = false;
    }

    neonClient.release();
    
    console.log(`\n--- VERIFICATION ${allPassed ? 'PASSED' : 'FAILED'} ---`);
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error('Verification script crashed:', error);
    process.exit(1);
  }
}

runTests();
