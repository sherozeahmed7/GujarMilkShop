import { Router } from 'express';
import { createActivityLog, getActivityLogs } from '../controllers/activityLog.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authenticateJWT, createActivityLog);
router.get('/', authenticateJWT, getActivityLogs);

export default router;
