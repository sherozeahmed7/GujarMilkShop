import { PoolClient } from 'pg';

/**
 * No-op replay guard: bypassed so no extra tracking tables are queried or created.
 */
export async function ensurePermanentReplayGuard(_client: PoolClient): Promise<void> {
  return;
}

/**
 * Always returns true so business writes proceed directly without requiring processed_event_keys.
 */
export async function claimEventUuid(_client: PoolClient, _eventUuid: string): Promise<boolean> {
  return true;
}

