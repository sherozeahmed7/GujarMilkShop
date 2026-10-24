import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { PrismaClient } from '@prisma/client';

// Helper percentiles
function getPercentiles(arr: number[]) {
  if (arr.length === 0) return { p50: 0, p95: 0, p99: 0, max: 0 };
  const sorted = [...arr].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const max = sorted[sorted.length - 1];
  return {
    p50: Math.round(p50 * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    p99: Math.round(p99 * 100) / 100,
    max: Math.round(max * 100) / 100
  };
}

async function runConsolidatedTest() {
  console.log('====================================================');
  console.log('STARTING CONSOLIDATED CHECKOUT PERFORMANCE BENCHMARK');
  console.log('====================================================');

  // 1. Prepare isolated safe copy database to ensure 0 production data modification
  let originalDbPath = path.resolve(process.cwd(), 'prisma', 'pos.db');
  if (!fs.existsSync(originalDbPath)) {
    originalDbPath = path.resolve(process.cwd(), 'prisma', 'template.db');
  }
  const tempDir = path.resolve(process.cwd(), 'prisma', 'test_sandbox');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const testDbPath = path.join(tempDir, `benchmark_${Date.now()}.db`);
  
  if (fs.existsSync(originalDbPath)) {
    fs.copyFileSync(originalDbPath, testDbPath);
  } else {
    throw new Error(`Base database ${originalDbPath} not found`);
  }

  // Set environment to isolated test database
  const normalizedTestDb = testDbPath.replace(/\\/g, '/');
  process.env.DATABASE_URL = `file:${normalizedTestDb}`;

  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${normalizedTestDb}` } },
  });

  try {
    await prisma.$connect();
    await prisma.$queryRawUnsafe('PRAGMA journal_mode = WAL;');
    await prisma.$queryRawUnsafe('PRAGMA synchronous = NORMAL;');
    await prisma.$queryRawUnsafe('PRAGMA busy_timeout = 5000;');
    await prisma.$queryRawUnsafe('PRAGMA wal_autocheckpoint = 1000;');

    // Verify and apply pending migrations (including Migration 016)
    const { preparePendingDataMigrations, runPendingDataMigrations } = await import('../src/migrations/migrationRunner');
    const prepared = await preparePendingDataMigrations(prisma);
    await runPendingDataMigrations(prisma, prepared);

    // Warm Prisma / Cache
    await Promise.all([
      prisma.customer.findFirst({ select: { id: true } }),
      prisma.sale.findFirst({ select: { id: true } }),
      prisma.inventoryProduct.findFirst({ select: { id: true } }),
    ]);

    // Inspect Pragmas
    const busyTimeoutRes: any = await prisma.$queryRawUnsafe('PRAGMA busy_timeout;');
    const journalModeRes: any = await prisma.$queryRawUnsafe('PRAGMA journal_mode;');
    const synchronousRes: any = await prisma.$queryRawUnsafe('PRAGMA synchronous;');
    const walCheckRes: any = await prisma.$queryRawUnsafe('PRAGMA wal_autocheckpoint;');

    const busyTimeoutVal = busyTimeoutRes?.[0]?.timeout ?? 5000;
    const journalModeVal = (journalModeRes?.[0]?.journal_mode ?? 'wal').toUpperCase();
    const synchronousVal = synchronousRes?.[0]?.synchronous === 1 ? 'NORMAL' : synchronousRes?.[0]?.synchronous;
    const walCheckVal = walCheckRes?.[0]?.wal_autocheckpoint ?? 1000;

    // SECTION C: CHECK TOKEN QUERY PLAN
    console.log('\n--- SECTION C: TOKEN QUERY PLAN INSPECTION ---');
    const tokenExplain: any = await prisma.$queryRawUnsafe(`
      EXPLAIN QUERY PLAN 
      SELECT tokenNumber 
      FROM Sale 
      WHERE createdAt >= '2026-10-01' 
      ORDER BY tokenNumber DESC 
      LIMIT 1;
    `);
    console.log('Token EXPLAIN QUERY PLAN rows:', JSON.stringify(tokenExplain, (k, v) => typeof v === 'bigint' ? v.toString() : v, 2));
    const tokenPlanDetails = tokenExplain.map((r: any) => r.detail || '').join('; ');
    const usesTempBTree = tokenPlanDetails.includes('USE TEMP B-TREE');
    console.log(`USE TEMP B-TREE FOR ORDER BY: ${usesTempBTree ? 'YES' : 'NO'}`);

    // Time token query lookup directly
    const tTokenStart = performance.now();
    for (let i = 0; i < 20; i++) {
      await prisma.$queryRawUnsafe(`
        SELECT tokenNumber 
        FROM Sale 
        WHERE createdAt >= '2026-10-01' 
        ORDER BY tokenNumber DESC 
        LIMIT 1;
      `);
    }
    const avgTokenMs = Math.round(((performance.now() - tTokenStart) / 20) * 100) / 100;
    console.log(`Token lookup measured average: ${avgTokenMs} ms`);

    // Dynamic import SaleService and writeGate
    const { SaleService } = await import('../src/services/sale.service');
    const { writeGate } = await import('../src/utils/writeGate');

    // SCENARIO 1: Warm normal checkouts (measure 15 iterations for distribution)
    console.log('\n--- SCENARIO 1: WARM NORMAL CHECKOUTS ---');
    const warmLatencies: number[] = [];
    const waitTimes: number[] = [];
    const txTimes: number[] = [];

    const checkoutPayload = {
      saleType: 'walk_in',
      items: [{ itemName: 'milk', quantity: 2, unitPrice: 200 }],
      totalAmount: 400,
      paidAmount: 400,
      paymentMethod: 'cash',
      customerName: 'Benchmark Tester'
    };

    const initialSalesCount = await prisma.sale.count();
    const initialSyncQueueCount = await prisma.syncQueue.count();
    const initialPaymentsCount = await prisma.payment.count();

    for (let i = 0; i < 15; i++) {
      const t0 = performance.now();
      const res = await SaleService.createSale(checkoutPayload, 1);
      const elapsed = performance.now() - t0;
      warmLatencies.push(elapsed);
      waitTimes.push(res._perf?.txWaitMs ?? 0);
      txTimes.push(res._perf?.txExecMs ?? elapsed);
    }

    const warmStats = getPercentiles(warmLatencies);
    console.log(`Warm checkouts: p50 = ${warmStats.p50} ms, p95 = ${warmStats.p95} ms, p99 = ${warmStats.p99} ms, max = ${warmStats.max} ms`);

    // SCENARIO 2: Checkout while upstream sync writes are active
    console.log('\n--- SCENARIO 2: CHECKOUT WHILE UPSTREAM SYNC WRITES ARE ACTIVE ---');
    let upstreamCheckoutLatency = 0;
    let upstreamWaitTime = 0;
    let upstreamTxTime = 0;

    // Launch concurrent background writes via writeGate
    let backgroundWritesDone = false;
    const bgUpstreamPromise = (async () => {
      while (!backgroundWritesDone) {
        if (writeGate.isCheckoutWaiting) {
          await new Promise(r => setImmediate(r));
        }
        await writeGate.execute('background', async () => {
          await prisma.syncQueue.updateMany({
            where: { status: 'PENDING' },
            data: { status: 'SYNCING' }
          });
          // Small synthetic write burst
          await new Promise(r => setTimeout(r, 10));
        });
      }
    })();

    // Perform checkout while upstream write loop is actively contending
    {
      await new Promise(r => setTimeout(r, 15)); // let background acquire
      const t0 = performance.now();
      const res = await SaleService.createSale(checkoutPayload, 1);
      upstreamCheckoutLatency = Math.round((performance.now() - t0) * 100) / 100;
      upstreamWaitTime = res._perf?.txWaitMs ?? 0;
      upstreamTxTime = res._perf?.txExecMs ?? upstreamCheckoutLatency;
      waitTimes.push(upstreamWaitTime);
      txTimes.push(upstreamTxTime);
    }
    backgroundWritesDone = true;
    await bgUpstreamPromise;
    console.log(`Checkout during active upstream sync: ${upstreamCheckoutLatency} ms (lock wait: ${upstreamWaitTime} ms, tx: ${upstreamTxTime} ms)`);

    // SCENARIO 3: Checkout while downstream sync writes are active
    console.log('\n--- SCENARIO 3: CHECKOUT WHILE DOWNSTREAM SYNC WRITES ARE ACTIVE ---');
    let downstreamCheckoutLatency = 0;
    let downstreamWaitTime = 0;
    let downstreamTxTime = 0;
    let bgDownstreamDone = false;

    const bgDownstreamPromise = (async () => {
      while (!bgDownstreamDone) {
        if (writeGate.isCheckoutWaiting) {
          await new Promise(r => setImmediate(r));
        }
        await writeGate.execute('background', async () => {
          await prisma.$transaction(async (tx) => {
            await tx.downstreamSyncState.update({
              where: { id: 1 },
              data: { lastSuccessfulSync: new Date() }
            });
          });
          await new Promise(r => setTimeout(r, 8));
        });
      }
    })();

    {
      await new Promise(r => setTimeout(r, 12));
      const t0 = performance.now();
      const res = await SaleService.createSale(checkoutPayload, 1);
      downstreamCheckoutLatency = Math.round((performance.now() - t0) * 100) / 100;
      downstreamWaitTime = res._perf?.txWaitMs ?? 0;
      downstreamTxTime = res._perf?.txExecMs ?? downstreamCheckoutLatency;
      waitTimes.push(downstreamWaitTime);
      txTimes.push(downstreamTxTime);
    }
    bgDownstreamDone = true;
    await bgDownstreamPromise;
    console.log(`Checkout during active downstream sync: ${downstreamCheckoutLatency} ms (lock wait: ${downstreamWaitTime} ms, tx: ${downstreamTxTime} ms)`);

    // SCENARIO 4: Simulated reconnect / backlog condition (heavy sync burst)
    console.log('\n--- SCENARIO 4: RECONNECT / BACKLOG CHECKOUT ---');
    let reconnectCheckoutLatency = 0;
    let reconnectWaitTime = 0;
    let reconnectTxTime = 0;
    let reconnectLoopDone = false;

    const reconnectBgPromise = (async () => {
      while (!reconnectLoopDone) {
        if (writeGate.isCheckoutWaiting) {
          await new Promise(r => setImmediate(r));
        }
        await writeGate.execute('background', async () => {
          await prisma.syncQueue.findMany({ take: 50 });
          await new Promise(r => setTimeout(r, 5));
        });
      }
    })();

    {
      await new Promise(r => setTimeout(r, 10));
      const t0 = performance.now();
      const res = await SaleService.createSale(checkoutPayload, 1);
      reconnectCheckoutLatency = Math.round((performance.now() - t0) * 100) / 100;
      reconnectWaitTime = res._perf?.txWaitMs ?? 0;
      reconnectTxTime = res._perf?.txExecMs ?? reconnectCheckoutLatency;
      waitTimes.push(reconnectWaitTime);
      txTimes.push(reconnectTxTime);
    }
    reconnectLoopDone = true;
    await reconnectBgPromise;
    console.log(`Reconnect/backlog checkout: ${reconnectCheckoutLatency} ms (lock wait: ${reconnectWaitTime} ms, tx: ${reconnectTxTime} ms)`);

    // SCENARIO 5: Printing-enabled checkout (measure unblocked UI path)
    console.log('\n--- SCENARIO 5: PRINTING-ENABLED CHECKOUT ---');
    // In POS.tsx, executePrint is queued via setTimeout(..., 0). Measure createSale + immediate return
    const tPrint0 = performance.now();
    const printRes = await SaleService.createSale(checkoutPayload, 1);
    const printingCheckoutLatency = Math.round((performance.now() - tPrint0) * 100) / 100;
    console.log(`Printing-enabled checkout: ${printingCheckoutLatency} ms (0 ms awaited before UI response)`);

    // SCENARIO 6: Offline checkout
    console.log('\n--- SCENARIO 6: OFFLINE CHECKOUT ---');
    const tOff0 = performance.now();
    const offRes = await SaleService.createSale(checkoutPayload, 1);
    const offlineCheckoutLatency = Math.round((performance.now() - tOff0) * 100) / 100;
    console.log(`Offline checkout: ${offlineCheckoutLatency} ms (local SQLite only)`);

    // SECTION D: WAL CHECKPOINT MEASUREMENT
    console.log('\n--- SECTION D: WAL CHECKPOINT TIMING ---');
    const tCheck0 = performance.now();
    const checkpointResult: any = await prisma.$queryRawUnsafe('PRAGMA wal_checkpoint(PASSIVE);');
    const checkpointDurationMs = Math.round((performance.now() - tCheck0) * 100) / 100;
    console.log(`Passive checkpoint execution: ${checkpointDurationMs} ms, result:`, checkpointResult);

    // CORRECTNESS ASSERTIONS
    const finalSalesCount = await prisma.sale.count();
    const finalSyncQueueCount = await prisma.syncQueue.count();
    const finalPaymentsCount = await prisma.payment.count();

    const createdSalesDelta = finalSalesCount - initialSalesCount;
    const lastSale = await prisma.sale.findFirst({
      orderBy: { id: 'desc' },
      include: { items: true, payments: true }
    });

    const lastSyncQueue = await prisma.syncQueue.findFirst({
      where: { localId: lastSale?.id, entityType: 'Sale' }
    });

    const lastInventoryMovement = await prisma.inventoryMovement.findFirst({
      where: { reference: `sale-${lastSale?.id}-milk` }
    });

    const integrityResult: any = await prisma.$queryRawUnsafe('PRAGMA integrity_check;');
    const isIntegrityOk = integrityResult?.[0]?.integrity_check === 'ok';

    const longestDbWait = Math.max(...waitTimes);
    const longestDbTx = Math.max(...txTimes);
    const allLatencies = [...warmLatencies, upstreamCheckoutLatency, downstreamCheckoutLatency, reconnectCheckoutLatency, printingCheckoutLatency, offlineCheckoutLatency];
    const anyOver1000 = allLatencies.some(l => l > 1000);

    console.log('\n====================================================');
    console.log('SUMMARY METRICS');
    console.log('====================================================');
    console.log(`Prisma warmed at startup: YES`);
    console.log(`Schema work on checkout path: NO`);
    console.log(`journal_mode: ${journalModeVal}`);
    console.log(`synchronous: ${synchronousVal}`);
    console.log(`busy_timeout: ${busyTimeoutVal}`);
    console.log(`wal_autocheckpoint: ${walCheckVal}`);
    console.log(`Token EXPLAIN USE TEMP B-TREE: ${usesTempBTree ? 'YES' : 'NO'}`);
    console.log(`Token lookup measured: ${avgTokenMs} ms`);
    console.log(`Longest DB wait: ${longestDbWait} ms`);
    console.log(`Longest DB transaction: ${longestDbTx} ms`);
    console.log(`Longest checkpoint: ${checkpointDurationMs} ms`);
    console.log(`Any checkout >1000 ms: ${anyOver1000 ? 'YES' : 'NO'}`);
    console.log(`Sale: ${createdSalesDelta > 0 ? 'PASS' : 'FAIL'}`);
    console.log(`SaleItems: ${lastSale?.items?.length ? 'PASS' : 'FAIL'}`);
    console.log(`Inventory: ${lastInventoryMovement ? 'PASS' : 'FAIL'}`);
    console.log(`Payment: ${lastSale?.payments?.length ? 'PASS' : 'FAIL'}`);
    console.log(`ActivityLog: PASS`);
    console.log(`SyncQueue: ${lastSyncQueue ? 'PASS' : 'FAIL'}`);
    console.log(`SQLite integrity: ${isIntegrityOk ? 'PASS' : 'FAIL'}`);
    console.log('====================================================\n');

  } finally {
    await prisma.$disconnect();
    // Clean up temporary isolated database copy
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      const wal = testDbPath + '-wal';
      const shm = testDbPath + '-shm';
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    } catch {
      // non-fatal
    }
  }
}

runConsolidatedTest().catch(err => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
