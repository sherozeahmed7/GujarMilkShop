import { Router } from 'express';
import { migrateBatch } from '../controllers/sync.controller';
import { syncBatch } from '../controllers/syncBatch.controller';
import { syncDownstream, getDownstreamCursor } from '../controllers/syncDownstream.controller';
import {
  getSyncStatus,
  getSyncQueue,
  triggerSync,
  retryFailed,
  toggleSync,
  checkConnection,
  getFailedDiagnostics,
  runManualPrune,
} from '../controllers/syncStatus.controller';
import { restoreCloudData } from '../controllers/syncRestore.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { authenticateSyncInternal } from '../middleware/syncAuth.middleware';

const router = Router();

// Endpoint for receiving initial migration batches. Protected by JWT.
router.post('/migrate', authenticateJWT, migrateBatch);

// Endpoint for normal (upstream) synchronization. Protected by internal secret.
router.post('/batch', authenticateSyncInternal, syncBatch);

// Endpoint for downstream sync pull. Protected by internal secret.
router.get('/downstream', authenticateSyncInternal, syncDownstream);

// Endpoint to fetch current max cursor (used by fresh devices to initialize baseline).
router.get('/downstream/cursor', authenticateSyncInternal, getDownstreamCursor);

// ─── Cloud & Sync UI endpoints (JWT protected — called from React frontend) ───
router.get('/status',            authenticateJWT, getSyncStatus);
router.get('/queue',             authenticateJWT, getSyncQueue);
router.post('/trigger',          authenticateJWT, triggerSync);
router.post('/retry-failed',     authenticateJWT, retryFailed);
router.post('/toggle',           authenticateJWT, toggleSync);
router.post('/check-connection', authenticateJWT, checkConnection);
router.post('/restore',          authenticateJWT, restoreCloudData);
router.get('/failed-diagnostics', authenticateJWT, getFailedDiagnostics);
router.post('/prune',             authenticateJWT, runManualPrune);


export default router;
