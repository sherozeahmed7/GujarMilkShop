/**
 * Neon Sync Event Retention Manager
 * ============================================================
 * READ-ONLY analysis + transactionally safe cleanup with dry-run mode.
 *
 * Architecture understanding:
 *   cloud_sync_events  - append-only event log; downstream worker
 *                        reads events WHERE change_sequence > lastCursor
 *                        AND device_id != myDevice.
 *                        Used ONLY for delta sync between devices.
 *                        NOT used by the Restore function (which reads
 *                        business tables directly).
 *
 *   processed_event_keys - compact permanent event UUID tombstones; the
 *                          authoritative exactly-once replay guard.
 *   idempotency_log      - recent descriptive metadata for audit/diagnostics.
 *
 * Safe deletion rules:
 *   1. cloud_sync_events can be deleted when:
 *      a. The event's change_sequence <= safeFloor (all active devices
 *         have been given time to consume it), AND
 *      b. The event is older than RETENTION_DAYS.
 *
 *   2. idempotency_log can be age-pruned only after its event_uuid exists in
 *      processed_event_keys. The compact key is never pruned, so restored old
 *      backups and manual retries remain harmless without retaining verbose
 *      metadata forever.
 *
 *   3. A singleton sync_retention_state watermark is advanced in the same
 *      PostgreSQL transaction that deletes a safe event prefix. Downstream
 *      uses this explicit proof of deletion; it never infers deletion from
 *      MIN(change_sequence), because PostgreSQL sequence gaps are normal.
 *
 * Device cursor tracking (no server-side registry):
 *   Since DownstreamSyncState.lastCursor is stored locally on each device
 *   and not reported to the server, we use a conservative time-based floor.
 *   The floor = MAX(change_sequence of events older than RETENTION_DAYS AND
 *   authored before all other devices' last known activity).
 *
 * Devices present:
 *   - ca004d3c (primary, active daily, last event seq ~37783)
 *   - b055d5da (secondary, last event seq 30841, last active Sept 22 PKT)
 *   - 156862fe (tertiary, 6 events only, seq 31013-31018, inactive)
 *
 * Usage:
 *   node scripts/neon-retention-manager.js --dry-run
 *   node scripts/neon-retention-manager.js --dry-run --retention-days=14
 *   node scripts/neon-retention-manager.js --execute  (requires approval)
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// ─── Configuration ────────────────────────────────────────────────────────────

const CONFIG = {
  // How long to keep cloud_sync_events (days). Devices offline longer must RESTORE.
  RETENTION_DAYS: parseInt(process.env.SYNC_RETENTION_DAYS || '14', 10),

  // Recent descriptive metadata retention. Permanent replay protection lives
  // in processed_event_keys and is not governed by this age.
  IDEM_RETENTION_DAYS: parseInt(process.env.IDEM_RETENTION_DAYS || '30', 10),

  // Grace period for offline devices (days). Events newer than this are always kept.
  OFFLINE_GRACE_DAYS: parseInt(process.env.OFFLINE_GRACE_DAYS || '14', 10),

  // How many rows to delete per batch (prevents long locks).
  BATCH_SIZE: parseInt(process.env.CLEANUP_BATCH_SIZE || '500', 10),

  // Delay between batches (ms) to reduce I/O pressure.
  BATCH_DELAY_MS: parseInt(process.env.CLEANUP_BATCH_DELAY_MS || '200', 10),

  // Log file path.
  LOG_FILE: path.join(__dirname, '..', 'logs', 'sync-retention.log'),
};

// ─── CLI Argument Parsing ────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const VERBOSE = args.includes('--verbose');

// Override config from CLI
for (const arg of args) {
  const retMatch = arg.match(/--retention-days=(\d+)/);
  if (retMatch) CONFIG.RETENTION_DAYS = parseInt(retMatch[1], 10);

  const idemMatch = arg.match(/--idem-retention-days=(\d+)/);
  if (idemMatch) CONFIG.IDEM_RETENTION_DAYS = parseInt(idemMatch[1], 10);

  const batchMatch = arg.match(/--batch-size=(\d+)/);
  if (batchMatch) CONFIG.BATCH_SIZE = parseInt(batchMatch[1], 10);

  const graceMatch = arg.match(/--offline-grace-days=(\d+)/);
  if (graceMatch) CONFIG.OFFLINE_GRACE_DAYS = parseInt(graceMatch[1], 10);
}

// ─── Logging ────────────────────────────────────────────────────────────────

const logDir = path.dirname(CONFIG.LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function log(level, message, data) {
  const ts = new Date().toISOString();
  const prefix = DRY_RUN ? '[DRY-RUN]' : '[EXECUTE]';
  const line = `[${ts}] ${prefix} [${level}] ${message}` + (data ? ' ' + JSON.stringify(data) : '');
  console.log(line);
  fs.appendFileSync(CONFIG.LOG_FILE, line + '\n');
}

function logTable(label, rows) {
  log('INFO', label);
  if (rows.length === 0) {
    log('INFO', '  (no rows)');
    return;
  }
  const keys = Object.keys(rows[0]);
  const header = '  ' + keys.join(' | ');
  const separator = '  ' + keys.map(k => '-'.repeat(k.length)).join('-+-');
  log('INFO', header);
  log('INFO', separator);
  for (const row of rows) {
    log('INFO', '  ' + keys.map(k => String(row[k] ?? '')).join(' | '));
  }
}

// ─── Database Connection ─────────────────────────────────────────────────────

function getPool() {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) throw new Error('NEON_DATABASE_URL is not set in environment.');
  return new Pool({ connectionString: url });
}

// ─── Phase 1: Analysis (always READ-ONLY) ───────────────────────────────────

async function analyzeCurrentState(client) {
  log('INFO', '═══════════════════════════════════════════════════════');
  log('INFO', 'PHASE 1: Analyzing current state (READ ONLY)');
  log('INFO', '═══════════════════════════════════════════════════════');

  // 1a. Current sizes
  const sizes = await client.query(`
    SELECT
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size,
      pg_total_relation_size(relid) as total_bytes,
      pg_size_pretty(pg_table_size(relid)) as table_size,
      pg_size_pretty(pg_indexes_size(relid)) as index_size,
      n_live_tup as row_count
    FROM pg_stat_user_tables
    WHERE relname IN ('cloud_sync_events', 'idempotency_log', 'processed_event_keys')
    ORDER BY pg_total_relation_size(relid) DESC
  `);
  logTable('Current table sizes:', sizes.rows);

  // 1b. Per-device summary
  const deviceSummary = await client.query(`
    SELECT
      device_id,
      COUNT(*) as events,
      MIN(change_sequence) as first_seq,
      MAX(change_sequence) as last_seq,
      MIN(created_at) as first_event,
      MAX(created_at) as last_event
    FROM cloud_sync_events
    GROUP BY device_id
    ORDER BY last_event DESC
  `);
  logTable('Device event summary:', deviceSummary.rows);

  // 1c. Event age distribution
  const ageDistrib = await client.query(`
    SELECT
      CASE
        WHEN created_at >= NOW() - INTERVAL '1 day'   THEN '0-1 days'
        WHEN created_at >= NOW() - INTERVAL '3 days'  THEN '1-3 days'
        WHEN created_at >= NOW() - INTERVAL '7 days'  THEN '3-7 days'
        WHEN created_at >= NOW() - INTERVAL '14 days' THEN '7-14 days'
        WHEN created_at >= NOW() - INTERVAL '30 days' THEN '14-30 days'
        ELSE 'older than 30 days'
      END as age_bucket,
      COUNT(*) as events
    FROM cloud_sync_events
    GROUP BY age_bucket
    ORDER BY MIN(created_at)
  `);
  logTable('cloud_sync_events age distribution:', ageDistrib.rows);

  // 1d. Idempotency log age distribution
  const idemAge = await client.query(`
    SELECT
      CASE
        WHEN executed_at >= NOW() - INTERVAL '1 day'   THEN '0-1 days'
        WHEN executed_at >= NOW() - INTERVAL '3 days'  THEN '1-3 days'
        WHEN executed_at >= NOW() - INTERVAL '7 days'  THEN '3-7 days'
        WHEN executed_at >= NOW() - INTERVAL '14 days' THEN '7-14 days'
        WHEN executed_at >= NOW() - INTERVAL '30 days' THEN '14-30 days'
        ELSE 'older than 30 days'
      END as age_bucket,
      COUNT(*) as records
    FROM idempotency_log
    GROUP BY age_bucket
    ORDER BY MIN(executed_at)
  `);
  logTable('idempotency_log age distribution:', idemAge.rows);

  // 1e. Verify against the permanent guard when installed; otherwise verify
  // the legacy metadata that will be transactionally backfilled on upgrade.
  const replayGuard = await client.query(
    `SELECT to_regclass('public.processed_event_keys') AS table_name`
  );
  const permanentGuardInstalled = Boolean(replayGuard.rows[0]?.table_name);
  const idemGaps = permanentGuardInstalled
    ? await client.query(`
        SELECT COUNT(*) as cnt
        FROM cloud_sync_events cse
        LEFT JOIN processed_event_keys pek ON cse.event_uuid = pek.event_uuid
        WHERE pek.event_uuid IS NULL
      `)
    : await client.query(`
        SELECT COUNT(*) as cnt
        FROM cloud_sync_events cse
        LEFT JOIN idempotency_log il ON cse.event_uuid = il.event_uuid
        WHERE il.event_uuid IS NULL
      `);
  const idemGapCount = parseInt(idemGaps.rows[0].cnt, 10);
  if (idemGapCount > 0) {
    log('WARN', `⚠️  INTEGRITY ALERT: ${idemGapCount} events in cloud_sync_events have NO replay guard!`);
    log('WARN', '    These events may have been inserted outside the standard sync flow.');
  } else {
    log('INFO', `✅ Integrity check passed using ${permanentGuardInstalled ? 'processed_event_keys' : 'legacy idempotency_log'}.`);
  }

  return { sizes: sizes.rows, deviceSummary: deviceSummary.rows };
}

// ─── Phase 2: Calculate Safe Cleanup Floor ──────────────────────────────────

async function calculateSafeFloor(client, deviceSummary) {
  log('INFO', '');
  log('INFO', '═══════════════════════════════════════════════════════');
  log('INFO', 'PHASE 2: Calculating safe cleanup floor');
  log('INFO', '═══════════════════════════════════════════════════════');

  // Effective age is the stricter of retention and offline grace. The boundary
  // is an event-order prefix: once the first protected event is encountered,
  // later rows are retained even if their timestamps are anomalously older.
  // Missing integer sequence values are ignored and never interpreted as rows.
  const effectiveRetentionDays = Math.max(CONFIG.RETENTION_DAYS, CONFIG.OFFLINE_GRACE_DAYS);
  const floorResult = await client.query(
    `WITH first_protected AS (
       SELECT MIN(change_sequence) AS first_sequence
       FROM cloud_sync_events
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
     )
     SELECT
       COALESCE(MAX(cse.change_sequence), 0) AS safe_floor,
       (SELECT first_sequence FROM first_protected) AS first_protected_sequence
     FROM cloud_sync_events cse, first_protected fp
     WHERE cse.created_at < NOW() - ($1::int * INTERVAL '1 day')
       AND (fp.first_sequence IS NULL OR cse.change_sequence < fp.first_sequence)`,
    [effectiveRetentionDays]
  );
  const safeFloor = BigInt(floorResult.rows[0].safe_floor || '0');
  const firstProtectedSequence = floorResult.rows[0].first_protected_sequence == null
    ? null
    : BigInt(floorResult.rows[0].first_protected_sequence);

  // Also check: when was each device last seen? If a device has been
  // completely silent (no new uploads), it might still be consuming old events.
  const deviceActivity = await client.query(`
    SELECT device_id,
           MAX(created_at) as last_seen,
           NOW() - MAX(created_at) as inactive_for
    FROM cloud_sync_events
    GROUP BY device_id
  `);
  logTable('Device last activity:', deviceActivity.rows);

  // For devices that have gone silent (inactive for > OFFLINE_GRACE_DAYS),
  // we cannot guarantee their cursor position. However, since the Restore
  // endpoint bypasses cloud_sync_events entirely (reads business tables directly),
  // these devices should use Restore if they've been offline too long.

  log('INFO', `Config: RETENTION_DAYS=${CONFIG.RETENTION_DAYS}, OFFLINE_GRACE_DAYS=${CONFIG.OFFLINE_GRACE_DAYS}`);
  log('INFO', `Effective protected age: ${effectiveRetentionDays} days`);
  log('INFO', `First protected event sequence: ${firstProtectedSequence ?? 'none'}`);

  // Retention cutoff: events older than RETENTION_DAYS are candidates
  const retentionResult = await client.query(
    `SELECT COALESCE(MAX(change_sequence), 0) as retention_max
     FROM cloud_sync_events
     WHERE created_at < NOW() - INTERVAL '${CONFIG.RETENTION_DAYS} days'`
  );
  const retentionMax = BigInt(retentionResult.rows[0].retention_max || '0');

  log('INFO', `Retention cutoff max sequence (events older than ${CONFIG.RETENTION_DAYS} days): ${retentionMax}`);
  log('INFO', `Final safe event-prefix boundary (max seq to delete): ${safeFloor}`);

  if (safeFloor <= BigInt(0)) {
    log('INFO', '✅ Safe floor is 0: no events are old enough to delete yet.');
    log('INFO', `   The database is ${CONFIG.RETENTION_DAYS} days old or younger, or all events are within the retention window.`);
  }

  return { safeFloor, firstProtectedSequence, retentionMax, effectiveRetentionDays };
}

// ─── Phase 3: Simulate What Would Be Deleted ────────────────────────────────

async function simulateCleanup(client, safeFloor) {
  log('INFO', '');
  log('INFO', '═══════════════════════════════════════════════════════');
  log('INFO', 'PHASE 3: Simulating cleanup (READ ONLY)');
  log('INFO', '═══════════════════════════════════════════════════════');

  // Count deletable cloud_sync_events
  const eventCount = await client.query(
    `SELECT COUNT(*) as cnt,
            pg_size_pretty(SUM(pg_column_size(cse.*))) as approx_data_size
     FROM cloud_sync_events cse
     WHERE change_sequence <= $1
       AND created_at < NOW() - ($2::int * INTERVAL '1 day')`,
    [safeFloor.toString(), Math.max(CONFIG.RETENTION_DAYS, CONFIG.OFFLINE_GRACE_DAYS)]
  );
  const eventsToDelete = parseInt(eventCount.rows[0].cnt, 10);
  log('INFO', `cloud_sync_events to delete: ${eventsToDelete} (approx data: ${eventCount.rows[0].approx_data_size})`);

  const guardTable = await client.query(
    `SELECT to_regclass('public.processed_event_keys') AS table_name`
  );
  const guardExists = Boolean(guardTable.rows[0]?.table_name);
  const idemCount = guardExists
    ? await client.query(
        `SELECT COUNT(*) as cnt
         FROM idempotency_log il
         JOIN processed_event_keys pek ON pek.event_uuid = il.event_uuid
         WHERE il.executed_at < NOW() - ($1::int * INTERVAL '1 day')`,
        [CONFIG.IDEM_RETENTION_DAYS]
      )
    : await client.query(
        `SELECT COUNT(*) as cnt
         FROM idempotency_log
         WHERE executed_at < NOW() - ($1::int * INTERVAL '1 day')`,
        [CONFIG.IDEM_RETENTION_DAYS]
      );
  const idemToDelete = parseInt(idemCount.rows[0].cnt, 10);
  const idemAgeQualified = idemToDelete;
  log('INFO', `idempotency_log records eligible after permanent-key verification/backfill: ${idemToDelete} (older than ${CONFIG.IDEM_RETENTION_DAYS} days)`);
  if (!guardExists) {
    log('INFO', 'processed_event_keys is not installed yet; execute mode will transactionally backfill it before any metadata deletion.');
  }

  // Breakdown of what would be deleted by entity type
  if (eventsToDelete > 0) {
    const byType = await client.query(
      `SELECT entity_type, COUNT(*) as cnt
       FROM cloud_sync_events
       WHERE change_sequence <= $1
         AND created_at < NOW() - ($2::int * INTERVAL '1 day')
       GROUP BY entity_type
       ORDER BY cnt DESC`,
      [safeFloor.toString(), Math.max(CONFIG.RETENTION_DAYS, CONFIG.OFFLINE_GRACE_DAYS)]
    );
    logTable('Events to delete by entity type:', byType.rows);
  }

  // Estimate storage savings:
  // Average row size for cloud_sync_events ≈ (total table bytes) / row count
  const tableMeta = await client.query(`
    SELECT pg_table_size(relid) as table_bytes, n_live_tup as row_count
    FROM pg_stat_user_tables WHERE relname = 'cloud_sync_events'
  `);
  const { table_bytes, row_count } = tableMeta.rows[0];
  const avgRowBytes = row_count > 0 ? parseInt(table_bytes) / parseInt(row_count) : 0;
  const estimatedSavingsBytes = Math.round(avgRowBytes * eventsToDelete);

  log('INFO', `Estimated storage reclaimed from cloud_sync_events: ~${(estimatedSavingsBytes / 1024 / 1024).toFixed(2)} MB`);

  // Check that we won't delete any event that is STILL needed for downstream
  // Verify: after deletion, what would be the new minimum sequence?
  if (eventsToDelete > 0) {
    const newMin = await client.query(
      `SELECT MIN(change_sequence) as new_min
       FROM cloud_sync_events
       WHERE change_sequence > $1`,
      [safeFloor.toString()]
    );
    log('INFO', `After cleanup, minimum remaining sequence would be: ${newMin.rows[0].new_min}`);
    log('INFO', '✅ Devices that have consumed events up to this sequence are safe.');
    log('INFO', '⚠️  Devices whose lastCursor is below this minimum MUST use Restore.');
  }

  // Verify: events being considered for deletion are ALL confirmed in idempotency_log
  const confirmedIdem = await client.query(
    `SELECT COUNT(*) as cnt
     FROM cloud_sync_events cse
     JOIN idempotency_log il ON cse.event_uuid = il.event_uuid
     WHERE cse.change_sequence <= $1
       AND cse.created_at < NOW() - ($2::int * INTERVAL '1 day')`,
    [safeFloor.toString(), Math.max(CONFIG.RETENTION_DAYS, CONFIG.OFFLINE_GRACE_DAYS)]
  );
  const confirmedCount = parseInt(confirmedIdem.rows[0].cnt, 10);
  
  if (confirmedCount === eventsToDelete) {
    log('INFO', `✅ Idempotency safety check passed: all ${eventsToDelete} events-to-delete have idempotency_log records.`);
  } else {
    log('WARN', `⚠️  Idempotency mismatch: ${eventsToDelete} events to delete but only ${confirmedCount} have idempotency records!`);
    log('WARN', '    DO NOT proceed with cleanup until this is investigated.');
  }

  return { eventsToDelete, idemToDelete, idemAgeQualified, estimatedSavingsBytes };
}

// ─── Phase 4: Execute Cleanup (only when --execute is passed) ───────────────

async function executeCleanup(client) {
  log('INFO', '');
  log('INFO', '═══════════════════════════════════════════════════════');
  log('INFO', 'PHASE 4: Executing cleanup');
  log('INFO', '═══════════════════════════════════════════════════════');
  log('WARN', '⚠️  DESTRUCTIVE OPERATION IN PROGRESS — SEE LOG FOR FULL AUDIT TRAIL');

  let totalEventsDeleted = 0;
  let totalIdemDeleted = 0;
  let committedWatermark = 0n;

  await client.query('BEGIN');
  try {
    // DDL is deliberately execute-only and transactional: npm run sync:audit
    // never creates or mutates retention state.
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_retention_state (
        singleton_id SMALLINT PRIMARY KEY CHECK (singleton_id = 1),
        max_deleted_sequence BIGINT NOT NULL DEFAULT 0 CHECK (max_deleted_sequence >= 0),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      INSERT INTO sync_retention_state (singleton_id, max_deleted_sequence)
      VALUES (1, 0)
      ON CONFLICT (singleton_id) DO NOTHING
    `);
    const state = await client.query(
      `SELECT max_deleted_sequence
       FROM sync_retention_state
       WHERE singleton_id = 1
       FOR UPDATE`
    );
    const previousWatermark = BigInt(state.rows[0].max_deleted_sequence || '0');

    // Backfill the compact permanent replay guard before removing any verbose
    // metadata. Both steps commit or roll back together.
    await client.query(`
      CREATE TABLE IF NOT EXISTS processed_event_keys (
        event_uuid UUID PRIMARY KEY
      )
    `);
    await client.query(`
      INSERT INTO processed_event_keys (event_uuid)
      SELECT event_uuid FROM idempotency_log
      UNION
      SELECT event_uuid FROM cloud_sync_events
      ON CONFLICT (event_uuid) DO NOTHING
    `);

    // Recalculate under the cleanup transaction. The first protected event
    // ends the deletable prefix; ordinary integer gaps do not affect it.
    const floorData = await calculateSafeFloor(client, []);
    const safeFloor = floorData.safeFloor;
    committedWatermark = previousWatermark;

    if (safeFloor > previousWatermark) {
      const result = await client.query(
        `DELETE FROM cloud_sync_events
         WHERE change_sequence > $1
           AND change_sequence <= $2
           AND created_at < NOW() - ($3::int * INTERVAL '1 day')`,
        [previousWatermark.toString(), safeFloor.toString(), floorData.effectiveRetentionDays]
      );
      totalEventsDeleted = result.rowCount || 0;

      // Never advance merely because a sequence number is absent. At least one
      // actual history row must have been deleted in this same transaction.
      if (totalEventsDeleted > 0) {
        await client.query(
          `UPDATE sync_retention_state
           SET max_deleted_sequence = $1, updated_at = CURRENT_TIMESTAMP
           WHERE singleton_id = 1`,
          [safeFloor.toString()]
        );
        committedWatermark = safeFloor;
      }
    }

    const idemDelete = await client.query(
      `DELETE FROM idempotency_log il
       WHERE il.executed_at < NOW() - ($1::int * INTERVAL '1 day')
         AND EXISTS (
           SELECT 1 FROM processed_event_keys pek
           WHERE pek.event_uuid = il.event_uuid
         )`,
      [CONFIG.IDEM_RETENTION_DAYS]
    );
    totalIdemDeleted = idemDelete.rowCount || 0;
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  log('INFO', `✅ cloud_sync_events cleanup committed. Total deleted: ${totalEventsDeleted}`);
  log('INFO', `✅ cleanup watermark after commit: ${committedWatermark}`);
  log('INFO', `✅ idempotency_log metadata cleanup committed. Total deleted: ${totalIdemDeleted}`);
  log('INFO', '✅ processed_event_keys retained permanently for old replay protection.');

  // Step 3: Post-cleanup verification
  log('INFO', '');
  log('INFO', 'POST-CLEANUP VERIFICATION:');

  const remaining = await client.query(`
    SELECT
      relname as table_name,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size,
      n_live_tup as row_count
    FROM pg_stat_user_tables
    WHERE relname IN ('cloud_sync_events', 'idempotency_log', 'processed_event_keys')
    ORDER BY pg_total_relation_size(relid) DESC
  `);
  logTable('Remaining sizes after cleanup:', remaining.rows);

  // Check the permanent replay guard, not the intentionally bounded metadata.
  const idemGaps = await client.query(`
    SELECT COUNT(*) as cnt
    FROM cloud_sync_events cse
    LEFT JOIN processed_event_keys pek ON cse.event_uuid = pek.event_uuid
    WHERE pek.event_uuid IS NULL
  `);
  const gapCount = parseInt(idemGaps.rows[0].cnt, 10);
  if (gapCount > 0) {
    log('WARN', `⚠️  POST-CLEANUP: ${gapCount} remaining cloud_sync_events have no permanent replay key.`);
  } else {
    log('INFO', '✅ Post-cleanup integrity check: all remaining cloud_sync_events have permanent replay keys.');
  }

  return { totalEventsDeleted, totalIdemDeleted, committedWatermark };
}

// ─── Phase 5: Generate Summary Report ───────────────────────────────────────

async function generateReport(analysisData, floorData, simulationData, cleanupData) {
  log('INFO', '');
  log('INFO', '═══════════════════════════════════════════════════════');
  log('INFO', 'FINAL SUMMARY REPORT');
  log('INFO', '═══════════════════════════════════════════════════════');

  log('INFO', `Mode: ${DRY_RUN ? 'DRY RUN (no data modified)' : 'EXECUTE (data deleted)'}`);
  log('INFO', `Config: retention=${CONFIG.RETENTION_DAYS}d, idem_retention=${CONFIG.IDEM_RETENTION_DAYS}d, grace=${CONFIG.OFFLINE_GRACE_DAYS}d, batch=${CONFIG.BATCH_SIZE}`);
  log('INFO', '');
  log('INFO', `Safe floor calculated: ${floorData.safeFloor}`);
  log('INFO', `First protected sequence: ${floorData.firstProtectedSequence ?? 'none'}`);
  log('INFO', `Effective event retention: ${floorData.effectiveRetentionDays} days`);
  log('INFO', `Retention max (max seq older than ${CONFIG.RETENTION_DAYS} days): ${floorData.retentionMax}`);
  log('INFO', '');
  log('INFO', 'Simulation results:');
  log('INFO', `  cloud_sync_events to delete: ${simulationData.eventsToDelete}`);
  log('INFO', `  idempotency_log to delete:   ${simulationData.idemToDelete}`);
  log('INFO', `  idempotency metadata age-qualified: ${simulationData.idemAgeQualified}`);
  log('INFO', `  Estimated storage savings:   ~${(simulationData.estimatedSavingsBytes / 1024 / 1024).toFixed(2)} MB`);

  if (!DRY_RUN && cleanupData) {
    log('INFO', '');
    log('INFO', 'Actual cleanup results:');
    log('INFO', `  cloud_sync_events deleted: ${cleanupData.totalEventsDeleted}`);
    log('INFO', `  idempotency_log deleted:   ${cleanupData.totalIdemDeleted}`);
    log('INFO', `  committed cleanup watermark: ${cleanupData.committedWatermark}`);
  }

  log('INFO', '');
  log('INFO', 'REMAINING RISKS:');
  log('INFO', '  1. Devices offline for longer than OFFLINE_GRACE_DAYS cannot catch up via delta sync.');
  log('INFO', '     → They MUST use the Restore endpoint (/api/sync/restore).');
  log('INFO', '  2. The database has no server-side cursor registry for device positions.');
  log('INFO', '     → If OFFLINE_GRACE_DAYS is too short, offline devices will miss changes.');
  log('INFO', '     → Current setting is SAFE at 14 days.');
  log('INFO', '  3. The bulk import on 2026-09-21 (30,001 events) is the largest source of bloat.');
  log('INFO', '     → These events are from a one-time data migration (b055d5da device).');
  log('INFO', '     → They will be eligible for deletion once RETENTION_DAYS have passed.');
  log('INFO', '  4. Daily growth rate: ~1,800-2,300 events/day (healthy for a milk shop POS).');
  log('INFO', '     → At this rate, 14-day retention keeps ~25,000-32,000 events maximum.');
  log('INFO', '');
  log('INFO', 'RECOMMENDATIONS:');
  log('INFO', '  • Run this script daily (or weekly) via a scheduled job.');
  log('INFO', '  • Keep the configured retention and offline-grace values under operational review.');
  log('INFO', '  • Never prune processed_event_keys; they are the compact permanent replay guard.');
  log('INFO', '  • Keep Restore endpoint as the fallback for devices offline > 14 days.');
  log('INFO', '');

  if (DRY_RUN) {
    log('INFO', '══════════════════════════════════════════════════════');
    log('INFO', 'DRY RUN COMPLETE. No data was modified.');
    log('INFO', 'Review the plan above. When ready, run:');
    log('INFO', '  node scripts/neon-retention-manager.js --execute');
    log('INFO', '  (execute only after explicit approval and review of this dry run)');
    log('INFO', '══════════════════════════════════════════════════════');
  }
}

// ─── Main Entry Point ────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) {
    log('INFO', '=== NEON SYNC RETENTION MANAGER — DRY RUN MODE ===');
    log('INFO', 'No data will be modified. Pass --execute to perform cleanup.');
  } else {
    log('WARN', '=== NEON SYNC RETENTION MANAGER — EXECUTE MODE ===');
    log('WARN', 'DATA WILL BE PERMANENTLY DELETED. This is irreversible.');
    log('WARN', 'Ensure you have reviewed the dry-run output first.');
    // 3-second pause to allow Ctrl+C cancellation
    log('WARN', 'Starting in 3 seconds... (Ctrl+C to abort)');
    await new Promise(r => setTimeout(r, 3000));
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    let cleanupData = null;

    // Phase 1: Analyze
    const analysisData = await analyzeCurrentState(client);

    // Phase 2: Calculate floor
    const floorData = await calculateSafeFloor(client, analysisData.deviceSummary);

    // Phase 3: Simulate
    const simulationData = await simulateCleanup(client, floorData.safeFloor);

    // Phase 4: Execute (only when --execute flag is passed)
    if (!DRY_RUN) {
      if (simulationData.eventsToDelete === 0 && simulationData.idemToDelete === 0) {
        log('INFO', 'Nothing to delete. Exiting.');
      } else {
        cleanupData = await executeCleanup(client);
      }
    }

    // Phase 5: Report
    await generateReport(analysisData, floorData, simulationData, cleanupData);

  } catch (err) {
    log('ERROR', 'Unexpected error during retention management: ' + err.message);
    console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  calculateSafeFloor,
  simulateCleanup,
  executeCleanup,
};
