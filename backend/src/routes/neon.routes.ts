import { Router, Request, Response } from 'express';
import { testNeonConnection } from '../config/neonDb';

const router = Router();

/**
 * GET /api/neon/ping
 *
 * Safe read-only health check for the Neon PostgreSQL connection.
 * Runs: SELECT NOW()
 * Returns the Neon server timestamp on success.
 *
 * This route does NOT require authentication — it is for connectivity testing only.
 */
router.get('/ping', async (req: Request, res: Response) => {
  try {
    const now = await testNeonConnection();
    return res.json({
      status: 'success',
      message: 'Neon PostgreSQL connection is healthy.',
      neon_server_time: now,
    });
  } catch (err: any) {
    console.error('[Neon Ping] Connection test failed:', err.message);
    return res.status(503).json({
      status: 'error',
      message: 'Neon PostgreSQL connection failed.',
      detail: err.message,
    });
  }
});

export default router;
