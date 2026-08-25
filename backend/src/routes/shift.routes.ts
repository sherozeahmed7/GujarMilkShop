import { Router } from 'express';
import { ShiftController } from '../controllers/shift.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticateJWT);
router.get('/', ShiftController.list);
router.post('/', ShiftController.open);
router.post('/close', ShiftController.close);

export default router;