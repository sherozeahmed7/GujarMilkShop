import { Router } from 'express';
import { getPOSConfig, updatePOSConfig } from '../controllers/posConfig.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT);

router.get('/', getPOSConfig);
router.put('/', updatePOSConfig);

export default router;
