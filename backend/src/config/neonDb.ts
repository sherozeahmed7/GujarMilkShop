import { Pool } from 'pg';

/**
 * Isolated Neon PostgreSQL connection pool.
 *
 * This is SEPARATE from the existing Prisma/SQLite setup (database.ts).
 * It does NOT replace or affect SQLite in any way.
 *
 * Requires NEON_DATABASE_URL to be set in backend/.env
 * Use the pooled connection string from the Neon Console.
 */
let neonPool: Pool | null = null;

export function getNeonPool(): Pool {
  if (!neonPool) {
    const url = process.env.NEON_DATABASE_URL;
    if (!url) {
      throw new Error('[Neon] NEON_DATABASE_URL is not set in environment variables.');
    }
    neonPool = new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 5,            // small pool — this is the cloud mirror, not the primary DB
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    neonPool.on('error', (err) => {
      console.error('[Neon] Unexpected pool error:', err.message);
    });

    console.log('[Neon] PostgreSQL pool initialized.');
  }
  return neonPool;
}

/**
 * Tests the Neon connection by running SELECT NOW().
 * Returns the server timestamp on success, throws on failure.
 */
export async function testNeonConnection(): Promise<string> {
  const pool = getNeonPool();
  const result = await pool.query<{ now: string }>('SELECT NOW() as now');
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
