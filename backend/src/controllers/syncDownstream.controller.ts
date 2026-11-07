import { Request, Response } from 'express';
import { getNeonPool, queryWithRetry } from '../config/neonDb';

const DOWNSTREAM_BATCH_SIZE = parseInt(process.env.DOWNSTREAM_SYNC_BATCH_SIZE || '100', 10);

/**
 * GET /api/sync/downstream
 *
 * Query params:
 *   deviceId : string  — identity of the requesting device (used to exclude its own events)
 *   cursor   : string  — last change_sequence successfully applied (0 = start from beginning)
 *   limit    : string  — optional cap, max = DOWNSTREAM_BATCH_SIZE
 *
 * Response:
 *   { changes: DownstreamChange[], nextCursor: number, hasMore: boolean }
 */
export const syncDownstream = async (req: Request, res: Response): Promise<void> => {
  const { deviceId, cursor, limit } = req.query;

  if (!deviceId || typeof deviceId !== 'string') {
    res.status(400).json({ error: 'Missing required query parameter: deviceId' });
    return;
  }

  const parsedCursor = BigInt(typeof cursor === 'string' && cursor !== '' ? cursor : '0');
  const parsedLimit = Math.min(
    parseInt(typeof limit === 'string' ? limit : '100', 10) || DOWNSTREAM_BATCH_SIZE,
    DOWNSTREAM_BATCH_SIZE
  );

  let client: any = null;
  try {
    client = await getNeonPool().connect();
  } catch (err: any) {
    const isNetworkOrDnsError = 
      err?.code === 'ENOTFOUND' ||
      err?.code === 'EAI_AGAIN' ||
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'EHOSTUNREACH' ||
      err?.message?.includes('ENOTFOUND') ||
      err?.message?.includes('getaddrinfo');

    if (isNetworkOrDnsError) {
      // Cloud database is offline or DNS lookup failed; return 503 Service Unavailable gracefully without error stack
      res.status(503).json({
        offline: true,
        retryable: true,
        error: 'Cloud database currently unreachable (offline/DNS)',
        details: err.message
      });
      return;
    }

    console.error('[Downstream API] Error opening snapshot:', err.message);
    res.status(500).json({ error: 'Failed to fetch downstream changes' });
    return;
  }

  try {
    // The watermark check and event read must share one MVCC snapshot. If a
    // cleanup commits concurrently, this request sees either all pre-cleanup
    // history or the committed watermark and never a partial prefix.
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    // Only a persisted cleanup watermark proves that history was deleted.
    // MIN(change_sequence) is deliberately not used: PostgreSQL sequences may
    // contain normal gaps and a new installation may start above sequence 1.
    const stateTable = await client.query(
      `SELECT to_regclass('public.sync_retention_state') AS table_name`
    );
    let maxDeletedSequence = 0n;
    if (stateTable.rows[0]?.table_name) {
      const watermarkResult = await client.query(
        `SELECT COALESCE(max_deleted_sequence, 0) AS max_deleted_sequence
         FROM sync_retention_state
         WHERE singleton_id = 1`
      );
      maxDeletedSequence = BigInt(watermarkResult.rows[0]?.max_deleted_sequence || 0);
    }

    // A cursor equal to the watermark has consumed the entire deleted prefix.
    // Anything older is missing known-deleted history and must restore before
    // any downstream event is returned.
    if (parsedCursor < maxDeletedSequence) {
      await client.query('ROLLBACK');
      res.status(410).json({
        restoreRequired: true,
        reason: 'SYNC_HISTORY_EXPIRED',
        minimumSafeCursor: maxDeletedSequence.toString(),
        requestedCursor: parsedCursor.toString(),
        error: 'The requested sync cursor is too old. The missing history has been archived/deleted. A full restore is required.'
      });
      return;
    }

    // Fetch changes authored by OTHER devices, after the given cursor.
    // Uses queryWithRetry to handle Neon cold-start connection drops transparently.
    const result = await client.query(
      `SELECT
         change_sequence,
         event_uuid,
         device_id,
         entity_type,
         cloud_uuid,
         operation,
         payload,
         created_at
       FROM cloud_sync_events
       WHERE change_sequence > $1
         AND device_id != $2
       ORDER BY change_sequence ASC
       LIMIT $3`,
      [parsedCursor.toString(), deviceId, parsedLimit + 1] // fetch one extra to determine hasMore
    );

    const rows = result.rows;
    const hasMore = rows.length > parsedLimit;
    const changes = hasMore ? rows.slice(0, parsedLimit) : rows;

    const nextCursor = changes.length > 0
      ? changes[changes.length - 1].change_sequence.toString()
      : parsedCursor.toString();

    await client.query('COMMIT');
    res.status(200).json({
      changes: changes.map((r: any) => ({
        changeSequence: r.change_sequence.toString(),
        eventUuid: r.event_uuid,
        deviceId: r.device_id,
        entityType: r.entity_type,
        cloudUuid: r.cloud_uuid,
        operation: r.operation,
        payload: r.payload, // already JSONB object from postgres
        createdAt: r.created_at
      })),
      nextCursor,
      hasMore
    });
  } catch (err: any) {
    if (client) {
      await client.query('ROLLBACK').catch(() => { });
    }
    if (err?.code === '42P01' || err?.message?.includes('cloud_sync_events')) {
      // Table does not exist (single POS setup) - return empty changes gracefully
      res.status(200).json({
        changes: [],
        nextCursor: parsedCursor.toString(),
        hasMore: false
      });
      return;
    }

    const isNetworkOrDnsError = 
      err?.code === 'ENOTFOUND' ||
      err?.code === 'EAI_AGAIN' ||
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'EHOSTUNREACH' ||
      err?.message?.includes('ENOTFOUND') ||
      err?.message?.includes('getaddrinfo');

    if (isNetworkOrDnsError) {
      res.status(503).json({
        offline: true,
        retryable: true,
        error: 'Cloud database currently unreachable (offline/DNS)',
        details: err.message
      });
      return;
    }

    console.error('[Downstream API] Error fetching changes:', err.message);
    res.status(500).json({ error: 'Failed to fetch downstream changes', details: err.message });
  } finally {
    if (client) {
      client.release();
    }
  }
};

/**
 * GET /api/sync/downstream/cursor
 *
 * Returns the current maximum change_sequence in cloud_sync_events.
 * Used by a new device to initialize its baseline cursor (skip historical migration data).
 */
export const getDownstreamCursor = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await queryWithRetry(
      `SELECT COALESCE(MAX(change_sequence), 0) AS max_seq FROM cloud_sync_events`
    );
    res.status(200).json({
      cursor: result.rows[0].max_seq.toString()
    });
  } catch (err: any) {
    if (err?.code === '42P01' || err?.message?.includes('cloud_sync_events')) {
      // Table does not exist (single POS setup) - return cursor 0 gracefully
      res.status(200).json({ cursor: '0' });
      return;
    }

    const isNetworkOrDnsError = 
      err?.code === 'ENOTFOUND' ||
      err?.code === 'EAI_AGAIN' ||
      err?.code === 'ECONNREFUSED' ||
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'EHOSTUNREACH' ||
      err?.message?.includes('ENOTFOUND') ||
      err?.message?.includes('getaddrinfo');

    if (isNetworkOrDnsError) {
      res.status(503).json({
        cursor: '0',
        offline: true,
        error: 'Cloud database currently unreachable (offline/DNS)'
      });
      return;
    }

    console.error('[Downstream API] Error fetching cursor:', err.message);
    res.status(500).json({ error: 'Failed to fetch cursor' });
  }
};
