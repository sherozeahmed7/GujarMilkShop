/**
 * Phase 5 — Idempotent Historical Backfill Script
 *
 * Modes:
 *   DRY_RUN=true  npx ts-node scripts/phase5-backfill.ts   → reports without modifying
 *   DRY_RUN=false npx ts-node scripts/phase5-backfill.ts   → queues records
 *
 * Safety guarantees:
 *   - Never duplicates queue entries for same (entityType, localId, CREATE)
 *   - Preserves all existing cloudUUIDs from LocalToCloudMapping
 *   - Only creates new mappings where none exist
 *   - Respects dependency layers
 *   - Can be run multiple times safely
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import crypto from 'crypto';

const DRY_RUN = process.env.DRY_RUN !== 'false';
const prisma = new PrismaClient();
const pool = new Pool({ connectionString: process.env.NEON_DATABASE_URL });

// ─── Configuration ────────────────────────────────────────────────────────────

const DEVICE_ID = (() => {
  // Read device ID from the same place the app does
  try {
    const { getDeviceId } = require('../src/utils/deviceId');
    return getDeviceId();
  } catch {
    // Fallback: read from a known env or derive it
    return process.env.DEVICE_ID || 'unknown-device';
  }
})();

/** Maps Prisma model name → { neonTable, layer, prismaModel } */
const ENTITY_CONFIG: Record<string, { neonTable: string; layer: number; prismaModel: string }> = {
  // Layer 0 — no FK dependencies
  User:                 { neonTable: 'users',                   layer: 0, prismaModel: 'user' },
  Supplier:             { neonTable: 'suppliers',                layer: 0, prismaModel: 'supplier' },
  Customer:             { neonTable: 'customers',                layer: 0, prismaModel: 'customer' },
  InventoryProduct:     { neonTable: 'inventory_products',       layer: 0, prismaModel: 'inventoryProduct' },
  DailyRate:            { neonTable: 'daily_rates',              layer: 0, prismaModel: 'dailyRate' },

  // Layer 1 — depend on Layer 0
  Shift:                { neonTable: 'shifts',                   layer: 1, prismaModel: 'shift' },
  Sale:                 { neonTable: 'sales',                    layer: 1, prismaModel: 'sale' },
  SupplierCollection:   { neonTable: 'supplier_collections',     layer: 1, prismaModel: 'supplierCollection' },
  Expense:              { neonTable: 'expenses',                 layer: 1, prismaModel: 'expense' },

  // Layer 2 — depend on Layer 1
  SaleItem:             { neonTable: 'sale_items',               layer: 2, prismaModel: 'saleItem' },
  Payment:              { neonTable: 'payments',                 layer: 2, prismaModel: 'payment' },
  SupplierPayment:      { neonTable: 'supplier_payments',        layer: 2, prismaModel: 'supplierPayment' },
  ExpensePayment:       { neonTable: 'expense_payments',         layer: 2, prismaModel: 'expensePayment' },
  InventoryMovement:    { neonTable: 'inventory_movements',      layer: 2, prismaModel: 'inventoryMovement' },
  Return:               { neonTable: 'returns',                  layer: 2, prismaModel: 'return' },
  ReturnItem:           { neonTable: 'return_items',             layer: 2, prismaModel: 'returnItem' },
  CashPerson:           { neonTable: 'cash_persons',             layer: 0, prismaModel: 'cashPerson' },
  CashbookTransaction:  { neonTable: 'cashbook_transactions',    layer: 1, prismaModel: 'cashbookTransaction' },
};

// ─── Counters ─────────────────────────────────────────────────────────────────

const stats: Record<string, { skipped: number; queued: number; newMapping: number; alreadyInNeon: number }> = {};

function initStats(et: string) {
  if (!stats[et]) stats[et] = { skipped: 0, queued: 0, newMapping: 0, alreadyInNeon: 0 };
}

// ─── Core Logic ───────────────────────────────────────────────────────────────

async function processEntity(entityType: string, neonClient: any) {
  const cfg = ENTITY_CONFIG[entityType];
  if (!cfg) return;
  initStats(entityType);

  const rows: any[] = await (prisma as any)[cfg.prismaModel].findMany();

  for (const row of rows) {
    const localId: number = row.id;

    // 1. Check for existing mapping
    let mapping = await prisma.localToCloudMapping.findFirst({
      where: { entityType, localId },
    });

    let cloudUuid: string;

    if (mapping) {
      cloudUuid = mapping.cloudUuid;
    } else {
      // No mapping — assign a fresh UUID
      cloudUuid = crypto.randomUUID();
      if (DRY_RUN) {
        console.log(`  [DRY-RUN] ${entityType} localId=${localId}: WOULD CREATE mapping → ${cloudUuid}`);
        stats[entityType].newMapping++;
      } else {
        await prisma.localToCloudMapping.create({
          data: { entityType, localId, cloudUuid, deviceId: DEVICE_ID },
        });
        stats[entityType].newMapping++;
      }
    }

    // 2. Check if already in Neon
    const neonRes = await neonClient.query(
      `SELECT id FROM ${cfg.neonTable} WHERE id = $1`,
      [cloudUuid]
    );
    if (neonRes.rows.length > 0) {
      stats[entityType].alreadyInNeon++;
      continue; // Already synced — skip
    }

    // 3. Check for existing PENDING CREATE in queue
    const existingCreate = await prisma.syncQueue.findFirst({
      where: {
        entityType,
        localId,
        operation: 'CREATE',
        status: { in: ['PENDING', 'SYNCING'] },
      },
    });

    if (existingCreate) {
      stats[entityType].skipped++;
      continue; // Already queued — skip
    }

    // 4. Queue a CREATE
    const payload = buildPayload(row);

    if (DRY_RUN) {
      console.log(`  [DRY-RUN] ${entityType} localId=${localId}: WOULD QUEUE CREATE (cloudUuid=${cloudUuid})`);
      stats[entityType].queued++;
    } else {
      await prisma.syncQueue.create({
        data: {
          eventUuid: crypto.randomUUID(),
          deviceId: DEVICE_ID,
          entityType,
          localId,
          cloudUuid,
          operation: 'CREATE',
          payload: JSON.stringify(payload),
          status: 'PENDING',
          layer: cfg.layer,
          retryCount: 0,
          nextRetryAt: null,
          error: null,
        },
      });
      stats[entityType].queued++;
    }
  }
}

/** Build a clean payload from a SQLite row — strip internal Prisma fields */
function buildPayload(row: any): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id') continue; // local integer PK — never sent
    out[k] = v;
  }
  return out;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Phase 5 Backfill — mode: ${DRY_RUN ? 'DRY-RUN (no changes)' : 'EXECUTE'}`);
  console.log(`Device ID: ${DEVICE_ID}`);
  console.log(`${'='.repeat(60)}\n`);

  const neonClient = await pool.connect();

  try {
    // Process in dependency order (layer 0 → 1 → 2)
    const ordered = Object.entries(ENTITY_CONFIG)
      .sort(([, a], [, b]) => a.layer - b.layer);

    for (const [entityType] of ordered) {
      console.log(`Processing: ${entityType}...`);
      await processEntity(entityType, neonClient);
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('SUMMARY');
    console.log(`${'='.repeat(60)}`);
    let totalQueued = 0;
    let totalNew = 0;
    let totalSkipped = 0;
    let totalInNeon = 0;

    for (const [et, s] of Object.entries(stats)) {
      const line = `${et.padEnd(25)} queued=${s.queued}  newMapping=${s.newMapping}  alreadyInNeon=${s.alreadyInNeon}  skipped=${s.skipped}`;
      console.log(line);
      totalQueued += s.queued;
      totalNew += s.newMapping;
      totalSkipped += s.skipped;
      totalInNeon += s.alreadyInNeon;
    }

    console.log(`\nTotal queued:        ${totalQueued}`);
    console.log(`Total new mappings:  ${totalNew}`);
    console.log(`Already in Neon:     ${totalInNeon}`);
    console.log(`Skipped (in queue):  ${totalSkipped}`);
    console.log(`\nMode: ${DRY_RUN ? 'DRY-RUN — no changes were made.' : 'EXECUTE — records queued. Sync worker will process them.'}`);
    console.log(`${'='.repeat(60)}\n`);

  } finally {
    neonClient.release();
    await pool.end();
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
