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

  try {
    // Fetch changes authored by OTHER devices, after the given cursor.
    // Uses queryWithRetry to handle Neon cold-start connection drops transparently.
    const result = await queryWithRetry(
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
    console.error('[Downstream API] Error fetching changes:', err.message);
    res.status(500).json({ error: 'Failed to fetch downstream changes', details: err.message });
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
    console.error('[Downstream API] Error fetching cursor:', err.message);
    res.status(500).json({ error: 'Failed to fetch cursor' });
  }
};
