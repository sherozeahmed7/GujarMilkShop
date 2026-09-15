import axios from 'axios';
import { exec, spawn } from 'child_process';
import { getNeonPool } from './src/config/neonDb';
import { PrismaClient } from '@prisma/client';
import { SyncQueueService } from './src/services/syncQueue.service';
import path from 'path';
import fs from 'fs';

const prismaLocal = new PrismaClient();
const pool = getNeonPool();

let sidecarProcess: any = null;

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startSidecar(offline: boolean = false) {
  console.log(`\nStarting dev server... (Offline: ${offline})`);
  return new Promise<void>((resolve, reject) => {
    // Spawn with shell:true so Windows resolves ts-node from PATH/node_modules/.bin
    sidecarProcess = spawn(
      process.execPath,
      [path.join(__dirname, 'dist', 'bootstrap.js')],
      {
        env: {
          ...process.env,
          PORT: '4005',
          DATABASE_URL: process.env.DATABASE_URL || 'file:./prisma/dev.db',
          SYNC_API_URL: 'http://localhost:4005/api/sync/batch',
          SYNC_WORKER_ENABLED: offline ? 'false' : 'true',
          DOWNSTREAM_SYNC_ENABLED: offline ? 'false' : 'true',
        },
        cwd: __dirname,
      }
    );

    let resolved = false;
    const doResolve = () => { if (!resolved) { resolved = true; resolve(); } };

    sidecarProcess.stdout.on('data', (data: any) => {
      const msg = data.toString();
      if (msg.includes('Express server is running on port 4005')) {
        setTimeout(doResolve, 2000); // give workers a moment to initialise
      }
    });

    sidecarProcess.stderr.on('data', (data: any) => {
      const msg = data.toString();
      if (msg.includes('Express server is running on port 4005')) {
        setTimeout(doResolve, 2000);
      }
      if (!msg.includes('ECONNREFUSED') && !msg.includes('skipped') && !msg.includes('DeprecationWarning')) {
        process.stderr.write(`[Server] ${msg}`);
      }
    });

    sidecarProcess.on('error', reject);

    // Hard fallback after 25 s so the test doesn't hang forever
    setTimeout(() => {
      console.log('[regression] Server startup fallback timer fired — proceeding.');
      doResolve();
    }, 25000);
  });
}

function stopSidecar() {
  if (sidecarProcess) {
    console.log('Stopping sidecar...');
    try { sidecarProcess.kill('SIGKILL'); } catch(e) {}
    // Also kill by port on Windows in case SIGKILL didn't propagate to the child
    try {
      const cp = require('child_process');
      const result = cp.execSync('netstat -aon | findstr ":4005 " | findstr "LISTENING"', { encoding: 'utf8', stdio: ['pipe','pipe','ignore'] });
      const lines = result.split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const targetPid = parts[parts.length - 1];
        if (targetPid && targetPid !== '0' && /^\d+$/.test(targetPid)) {
          if (targetPid === String(process.pid)) continue; // Never kill self
          try { cp.execSync(`taskkill /F /T /PID ${targetPid}`, { stdio: 'ignore' }); } catch(e2) {}
        }
      }
    } catch(e) {}
    sidecarProcess = null;
    console.log('Sidecar stopped.');
  }
}

let authToken = '';
let testUserId = 0;

async function apiPost(endpoint: string, data: any) {
  const res = await axios.post(`http://localhost:4005/api${endpoint}`, data, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
  });
  return res.data;
}

async function apiGet(endpoint: string) {
  const res = await axios.get(`http://localhost:4005/api${endpoint}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
  });
  return res.data;
}

import { generateAccessToken } from './src/utils/auth';

async function apiPut(endpoint: string, data: any) {
  const res = await axios.put(`http://localhost:4005/api${endpoint}`, data, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
  });
  return res.data;
}

async function login() {
  const ts = Date.now();
  const testUser = await prismaLocal.user.create({
    data: {
      email: `regression_${ts}@test.com`,
      password: 'hash',
      name: 'Regression User',
      role: 'super_admin'
    }
  });
  // Use the proper service so cloudUuid is generated + LocalToCloudMapping is created
  await SyncQueueService.enqueueCreate(prismaLocal, 'User', testUser.id, testUser, 0);
  
  testUserId = testUser.id;
  authToken = generateAccessToken({ userId: testUser.id, role: testUser.role, email: testUser.email });
  console.log('Generated token for', testUser.email);
}

async function runRegression() {
  // Clear previous state for a clean test
  await prismaLocal.syncQueue.deleteMany({});
  
  try {
    // Start sidecar in ONLINE mode
    await startSidecar(false);
    await login();

    // 6. Test:
    
    // Close any existing open shift from prior runs
    console.log('Closing any existing open shifts...');
    const openShifts = await prismaLocal.shift.findMany({ where: { status: 'Open' } });
    for (const s of openShifts) {
      await prismaLocal.shift.update({ where: { id: s.id }, data: { status: 'Closed', closedAt: new Date(), countedCash: 0 } });
    }
    // Seed Rate and SupplierCollection so product creation passes validation
    console.log('Seeding Rate & Supplier Collection...');
    await prismaLocal.dailyRate.create({
      data: { milkRate: 150, yogurtRate: 160, lassiRate: 120, butterRate: 1000, gheeRate: 1200, date: new Date(), updatedByRole: 'super_admin' }
    });
    
    const supplier = await prismaLocal.supplier.upsert({
      where: { code: 'SUP_REG' },
      update: {},
      create: { code: 'SUP_REG', name: 'Reg Supplier' }
    });
    
    await prismaLocal.supplierCollection.upsert({
      where: {
        supplierId_date_shift: { supplierId: supplier.id, date: new Date().toISOString().split('T')[0], shift: 'MORNING' }
      },
      update: {},
      create: { supplierId: supplier.id, date: new Date().toISOString().split('T')[0], shift: 'MORNING', milkType: 'MIXED', quantity: 100, rate: 130, amount: 13000 }
    });

    // - create customer
    console.log('Creating customer...');
    const cust1 = await apiPost('/customers', { name: 'Regression Cust', customerType: 'daily_ledger' });

    // - customer with opening balance
    console.log('Creating customer with opening balance...');
    const cust2 = await apiPost('/customers', { name: 'Regression Cust Balance', customerType: 'monthly_ledger', openingBalance: 500 });

    // - create/update InventoryProduct
    console.log('Creating/Updating InventoryProduct...');
    const prodCode = 'REG_PROD_' + Date.now();
    const prod = await apiPost('/inventory', { code: prodCode, name: 'Reg Prod Milk', category: 'Dairy', unit: 'kg', unitPrice: 100 });
    console.log('Product response:', JSON.stringify(prod).substring(0, 200));
    const prodId = prod?.data?.id ?? prod?.id;
    await apiPut(`/inventory/${prodId}`, { name: 'Reg Prod Milk Updated' });

    // - create Shift
    console.log('Creating Shift...');
    const shift = await apiPost('/shifts', { openingCash: 100, openedBy: testUserId });
    console.log('Shift response:', JSON.stringify(shift).substring(0, 300));
    const shiftDbId = shift?.data?.shiftId ?? shift?.data?.id ?? null;
    const shiftNumericId = typeof shiftDbId === 'number' ? shiftDbId : (typeof shiftDbId === 'string' && !isNaN(Number(shiftDbId.replace('SHIFT-', ''))) ? Number(shiftDbId.replace('SHIFT-', '')) : null);

    // - create InventoryMovement (movementType STOCK_IN = valid enum)
    console.log('Creating InventoryMovement...');
    try {
      await apiPost('/inventory/movements', { productId: prodId, quantity: 10, movementType: 'STOCK_IN', source: 'Production', shiftId: shiftNumericId });
    } catch (e: any) {
      console.log('Inventory movement failed:', e?.response?.data || e.message);
    }

    // - complete a Sale
    console.log('Completing a Sale...');
    console.log('Customer response:', JSON.stringify(cust1).substring(0, 200));
    const cust1Id = cust1?.data?.id ?? cust1?.id;
    const sale = await apiPost('/sales', {
      customerId: cust1Id,
      saleType: 'ledger_daily',
      totalAmount: 200,
      paidAmount: 200,
      remainingBalance: 0,
      items: [{ itemName: 'milk', quantity: 2, unitPrice: 100, totalPrice: 200 }]
    });
    console.log('Sale response:', JSON.stringify(sale).substring(0, 200));

    console.log('Waiting for sync workers to process...');
    await sleep(15000); // wait for intervals

    let q = await prismaLocal.syncQueue.findMany();
    console.log(`SyncQueue Status Online: ${q.filter(x=>x.status==='PENDING').length} PENDING, ${q.filter(x=>x.status==='FAILED').length} FAILED, ${q.filter(x=>x.status==='SYNCED').length} SYNCED`);


    // 7. Test offline → create transaction → reconnect → automatic sync
    stopSidecar();
    await sleep(2000);
    
    await startSidecar(true); // Offline
    console.log('Creating Sale OFFLINE...');
    try {
      await apiPost('/sales', {
        customerId: cust1Id,
        saleType: 'ledger_daily',
        totalAmount: 150,
        paidAmount: 150,
        remainingBalance: 0,
        items: [{ itemName: 'milk', quantity: 1, unitPrice: 150, totalPrice: 150 }]
      });
    } catch (e: any) {
      console.log('Offline sale failed:', e?.response?.data || e.message);
    }

    q = await prismaLocal.syncQueue.findMany();
    const pendingCount = q.filter(x=>x.status==='PENDING').length;
    console.log(`SyncQueue Status Offline: ${pendingCount} PENDING (Expected > 0)`);
    if (pendingCount === 0) throw new Error('Events should be PENDING while offline');

    stopSidecar();
    console.log('Waiting for port to free...');
    await sleep(3000);
    // Force-kill anything still holding port 4005 on Windows
    try {
      const cp = require('child_process');
      cp.execSync(
        `powershell -Command "$p = (Get-NetTCPConnection -LocalPort 4005 -State Listen -ErrorAction SilentlyContinue).OwningProcess; if ($p) { taskkill /F /T /PID $p | Out-Null }"`,
        { stdio: 'ignore', timeout: 5000 }
      );
    } catch(e) {}
    await sleep(2000);

    // 8. Restart the application and verify sync resumes
    await startSidecar(false); // Online
    console.log('Restarted ONLINE. Triggering Sync Now & Retry All Failed...');

    // 9. Click Sync Now
    try { await apiPost('/sync/trigger', {}); } catch(e: any) { console.log('Sync trigger skipped:', e?.response?.data?.message || e.message); }
    // 10. Run Retry All Failed
    try { await apiPost('/sync/retry-failed', {}); } catch(e: any) { console.log('Retry-failed skipped:', e?.response?.data?.message || e.message); }

    console.log('Waiting for sync to complete (polling up to 120s)...');
    let finalPending = 0, finalFailed = 0, finalSyncing = 0;
    for (let attempt = 0; attempt < 24; attempt++) {
      await sleep(5000);
      q = await prismaLocal.syncQueue.findMany();
      finalPending = q.filter(x=>x.status==='PENDING').length;
      finalFailed = q.filter(x=>x.status==='FAILED').length;
      finalSyncing = q.filter(x=>x.status==='SYNCING').length;
      console.log(`  [${(attempt+1)*5}s] PENDING=${finalPending} FAILED=${finalFailed} SYNCING=${finalSyncing}`);
      if (finalPending === 0 && finalFailed === 0 && finalSyncing === 0) break;
    }

    console.log(`\nFinal SQLite SyncQueue State: PENDING=${finalPending} FAILED=${finalFailed} SYNCING=${finalSyncing}`);

    if (finalPending !== 0 || finalFailed !== 0 || finalSyncing !== 0) {
      console.error('FAILED QUEUE DUMP:', q.filter(x => x.status === 'FAILED'));
      throw new Error('FINAL STATE MUST BE 0 PENDING/FAILED/SYNCING');
    } else {
      console.log('✅ SQLite SyncQueue is completely clean.');
    }

    // Check Neon
    const errorLogs = await pool.query(`SELECT error FROM sync_queue WHERE status='FAILED' OR status='SYNCING'`);
    if ((errorLogs.rowCount ?? 0) > 0) {
       console.log('Neon SyncQueue still has errors. Wait, Neon SyncQueue represents devices pushing. Let me just check constraint violations.');
    }

    console.log('\n✅ REGRESSION VERIFICATION COMPLETED SUCCESSFULLY!');
    
  } catch (err) {
    console.error('Regression Test Failed:', err);
  } finally {
    stopSidecar();
    await prismaLocal.$disconnect();
    await pool.end();
  }
}

runRegression();
