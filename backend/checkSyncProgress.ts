import { PrismaClient } from '@prisma/client';
import path from 'path';
import os from 'os';
import { getNeonPool } from './src/config/neonDb';

const appDataBase = (process.env.APPDATA as string) || path.join(os.homedir(), 'AppData', 'Roaming');
const dbPath = path.join(appDataBase, 'com.shero.tauri-app', 'pos.db');

const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } }
});

async function checkLiveStatus() {
  console.log('=== DESKTOP POS LOCAL SQLITE STATUS ===');
  const pending = await prisma.syncQueue.count({ where: { status: 'PENDING' } });
  const syncing = await prisma.syncQueue.count({ where: { status: 'SYNCING' } });
  const failed = await prisma.syncQueue.count({ where: { status: 'FAILED' } });
  const synced = await prisma.syncQueue.count({ where: { status: 'SYNCED' } });

  console.log(`SyncQueue: ${pending} Pending, ${syncing} Syncing, ${failed} Failed, ${synced} Synced (Total: ${pending + syncing + failed + synced})`);

  const recentQueue = await prisma.syncQueue.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 5,
    select: {
      entityType: true,
      localId: true,
      operation: true,
      status: true,
      error: true,
      updatedAt: true
    }
  });
  console.log('Recent Queue Items:', recentQueue);

  const downstreamState = await prisma.downstreamSyncState.findUnique({ where: { id: 1 } });
  console.log('Local Downstream Cursor:', downstreamState?.lastCursor?.toString());
  console.log('Last Successful Sync:', downstreamState?.lastSuccessfulSync);
  console.log('Last Error:', downstreamState?.lastError);

  console.log('\n=== ONLINE NEON POSTGRESQL STATUS ===');
  try {
    const pool = getNeonPool();
    const client = await pool.connect();
    try {
      const maxSeqRes = await client.query('SELECT COALESCE(MAX(change_sequence), 0) AS max_seq FROM cloud_sync_events');
      const totalEventsRes = await client.query('SELECT COUNT(*) AS count FROM cloud_sync_events');
      const customersRes = await client.query('SELECT COUNT(*) AS count FROM customers');
      const salesRes = await client.query('SELECT COUNT(*) AS count FROM sales');
      const productsRes = await client.query('SELECT COUNT(*) AS count FROM inventory_products');

      console.log('Neon Cloud Events Count:', totalEventsRes.rows[0].count);
      console.log('Neon Cloud Max Sequence:', maxSeqRes.rows[0].max_seq);
      console.log(`Neon Data Tables: ${customersRes.rows[0].count} customers, ${salesRes.rows[0].count} sales, ${productsRes.rows[0].count} products`);
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('Neon Check Error:', err.message);
  }
}

checkLiveStatus().finally(() => {
  prisma.$disconnect();
  process.exit(0);
});
