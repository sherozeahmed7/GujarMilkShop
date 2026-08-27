import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { AuditController } from '../controllers/audit.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/bills', AuditController.getBillsForDate);
router.get('/',      AuditController.list);
router.post('/',     AuditController.create);

export default router;
