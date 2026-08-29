import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { ActivityLogController } from '../controllers/activityLog.controller';

const router = Router();
router.use(authenticateJWT);
router.get('/', ActivityLogController.list);
router.post('/', ActivityLogController.create);
export default router;
