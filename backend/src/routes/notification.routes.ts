import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { NotificationController } from '../controllers/notification.controller';

const router = Router();

// Protect all notification routes
router.use(authenticateJWT);

router.get('/', NotificationController.list);
router.patch('/read-all', NotificationController.markAllRead);
router.patch('/:id/read', NotificationController.markRead);
router.delete('/:id', NotificationController.delete);

export default router;
