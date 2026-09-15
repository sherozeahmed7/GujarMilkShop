import { Pool } from 'pg';

/**
 * Isolated Neon PostgreSQL connection pool.
 *
 * This is SEPARATE from the existing Prisma/SQLite setup (database.ts).
 * It does NOT replace or affect SQLite in any way.
 *
 * Requires NEON_DATABASE_URL to be set in backend/.env
 * Use the pooled connection string from the Neon Console.
 *
 * Neon serverless computes scale to zero after inactivity, which drops idle
 * TCP connections. When that happens pg emits 'Connection terminated unexpectedly'.
 * We handle this by:
 *  1. On pool-level 'error': destroy and recreate the pool on next access.
 *  2. queryWithRetry: retries once on connection-termination errors so that
 *     a cold-start wake-up succeeds transparently.
 */
let neonPool: Pool | null = null;

function createPool(): Pool {
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error('[Neon] NEON_DATABASE_URL is not set in environment variables.');
  }
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,                       // small pool — cloud mirror only
    idleTimeoutMillis: 20000,     // shorter than Neon's 5-min idle timeout
    connectionTimeoutMillis: 30000,
  });

  pool.on('error', (err) => {
    console.error('[Neon] Pool-level connection error (will recreate on next use):', err.message);
    // Destroy the pool reference so getNeonPool() creates a fresh one next time.
    // This handles "Connection terminated unexpectedly" from Neon scale-to-zero.
    neonPool = null;
  });

  console.log('[Neon] PostgreSQL pool initialized.');
  return pool;
}

export function getNeonPool(): Pool {
  if (!neonPool) {
    neonPool = createPool();
  }
  return neonPool;
}

/**
 * Determines if an error is a transient connection error that warrants a retry.
 * Covers Neon cold-start connection drops.
 */
function isConnectionError(err: any): boolean {
  if (!err) return false;
  const msg: string = err.message || '';
  return (
    msg.includes('Connection terminated unexpectedly') ||
    msg.includes('Connection terminated') ||
    msg.includes('connection terminated') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ETIMEDOUT') ||
    err.code === '57P01' || // admin_shutdown
    err.code === '08006' || // connection_failure
    err.code === '08001' || // unable_to_connect
    err.code === '08004'    // rejected_connection
  );
}

/**
 * Executes a query against Neon with one automatic retry on connection failures.
 * Use this in place of pool.query() anywhere a transient Neon connection drop
 * (cold-start wakeup) might cause the first query attempt to fail.
 */
export async function queryWithRetry(
  sql: string,
  params?: any[]
): Promise<any> {
  let lastErr: any;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const pool = getNeonPool();
      return await pool.query(sql, params);
    } catch (err: any) {
      lastErr = err;
      if (isConnectionError(err) && attempt === 0) {
        console.warn('[Neon] Connection error on attempt 1 — resetting pool and retrying:', err.message);
        // Force pool reset so the next attempt opens a fresh connection
        if (neonPool) {
          neonPool.end().catch(() => {}); // don't await — just drain silently
          neonPool = null;
        }
        // Brief pause to let Neon compute wake up
        await new Promise(res => setTimeout(res, 1500));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

/**
 * Tests the Neon connection by running SELECT NOW().
 * Returns the server timestamp on success, throws on failure.
 */
export async function testNeonConnection(): Promise<string> {
  const result = await queryWithRetry('SELECT NOW() as now');
  return result.rows[0].now;
}

/**
 * Safely closes the Neon pool. Call on graceful shutdown if needed.
 */
export async function closeNeonPool(): Promise<void> {
  if (neonPool) {
    await neonPool.end();
    neonPool = null;
    console.log('[Neon] PostgreSQL pool closed.');
  }
}
