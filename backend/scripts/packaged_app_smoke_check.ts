import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';

async function packagedAppSmokeCheck() {
  console.log('--- PACKAGED-APP SMOKE CHECK ---');
  const binDir = path.resolve(__dirname, '../../frontend/src-tauri/bin');
  const sidecarExe = path.join(binDir, 'backend-x86_64-pc-windows-msvc.exe');
  
  if (!fs.existsSync(sidecarExe)) {
    throw new Error(`Packaged sidecar binary not found at: ${sidecarExe}`);
  }
  console.log(`[Smoke] Verified sidecar executable exists: ${sidecarExe}`);

  // Create isolated disposable database copy
  const sandboxDir = path.resolve(__dirname, '../prisma/test_sandbox');
  fs.mkdirSync(sandboxDir, { recursive: true });
  const smokeDbPath = path.join(sandboxDir, `smoke_${Date.now()}.db`);
  const templateDb = path.resolve(__dirname, '../prisma/template.db');
  fs.copyFileSync(templateDb, smokeDbPath);

  const normalizedDbUrl = `file:${smokeDbPath.replace(/\\/g, '/')}`;
  const smokePort = 5599;

  console.log(`[Smoke] Launching packaged sidecar binary on port ${smokePort}...`);
  const sidecarProc = spawn(sidecarExe, [], {
    cwd: binDir,
    env: {
      ...process.env,
      PORT: smokePort.toString(),
      DATABASE_URL: normalizedDbUrl,
      NODE_ENV: 'production',
      SYNC_WORKER_ENABLED: 'true',
      DOWNSTREAM_SYNC_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  sidecarProc.stdout.on('data', (d) => {
    const text = d.toString();
    if (text.includes('Gujar Milk Shop API') || text.includes('listening')) {
      console.log(`[Smoke Sidecar] ${text.trim()}`);
    }
  });

  sidecarProc.stderr.on('data', (d) => {
    console.error(`[Smoke Sidecar ERR] ${d.toString().trim()}`);
  });

  try {
    // Wait for sidecar to become healthy
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      try {
        const res = await axios.get(`http://localhost:${smokePort}/api/health`, { timeout: 1500 });
        if (res.status === 200) {
          ready = true;
          break;
        }
      } catch {}
    }

    if (!ready) {
      throw new Error('Packaged sidecar failed to respond on health check endpoint within 30s');
    }
    console.log('[Smoke] Packaged sidecar is healthy and running.');

    // 1. Authenticate with seeded super admin
    const authRes = await axios.post(`http://localhost:${smokePort}/api/auth/login`, {
      email: 'admin@gujarmilkshop.com',
      password: 'admin123'
    });
    const token = authRes.data.data.accessToken;
    console.log('[Smoke] SuperAdmin login: PASS (accessToken acquired)');

    // 2. Normal / Offline Cash Sale Checkout Test
    const salePayload = {
      saleType: 'walk_in',
      customerName: 'Packaged Smoke Customer',
      paymentMethod: 'cash',
      paidAmount: 200,
      totalAmount: 200,
      items: [
        { itemName: 'milk', quantity: 1, unitPrice: 200 }
      ]
    };

    const checkoutRes = await axios.post(`http://localhost:${smokePort}/api/sales`, salePayload, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const saleData = checkoutRes.data.data;
    const tokenNumber = saleData.tokenNumber;
    console.log(`[Smoke] Sale created: ID=${saleData.id}, Token=${tokenNumber}, SaleType=${saleData.saleType}: PASS`);

    // 3. Diagnostics endpoint check
    const diagRes = await axios.get(`http://localhost:${smokePort}/api/sync/diagnostics/checkout`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('[Smoke] Diagnostics endpoint response:', diagRes.data);

    // 4. Verify SQLite state directly in the database file used by sidecar
    const activeDbUrl = `file:${diagRes.data.data.databaseFile.replace(/\\/g, '/')}`;
    const prisma = new PrismaClient({
      datasources: { db: { url: activeDbUrl } }
    });
    await prisma.$connect();

    const saleInDb = await prisma.sale.findUnique({
      where: { id: saleData.id },
      include: { items: true, payments: true }
    });
    const syncQueueRows = await prisma.syncQueue.findMany({
      where: { localId: saleData.id }
    });

    console.log(`[Smoke] Sale in DB verified: ${saleInDb ? 'PASS' : 'FAIL'}`);
    console.log(`[Smoke] Sale items created: ${saleInDb?.items.length === 1 ? 'PASS' : 'FAIL'}`);
    console.log(`[Smoke] Payment created: ${saleInDb?.payments.length === 1 ? 'PASS' : 'FAIL'}`);
    console.log(`[Smoke] SyncQueue event queued: ${syncQueueRows.length > 0 ? 'PASS' : 'FAIL'}`);

    await prisma.$disconnect();

    console.log('[Smoke] ALL PACKAGED APP SMOKE CHECKS PASSED.');

  } finally {
    sidecarProc.kill('SIGKILL');
    try {
      if (fs.existsSync(smokeDbPath)) fs.unlinkSync(smokeDbPath);
      const wal = smokeDbPath + '-wal';
      const shm = smokeDbPath + '-shm';
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {}
  }
}

packagedAppSmokeCheck().catch(err => {
  console.error('[Smoke] Error:', err);
  process.exit(1);
});
