import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { ReturnController } from '../controllers/return.controller';

const router = Router();
router.use(authenticateJWT);

router.get('/bill/:billNumber', ReturnController.lookupBill);
router.get('/',                 ReturnController.list);
router.post('/',                ReturnController.create);

export default router;
