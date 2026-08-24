import { Router } from 'express';
import { HeldCartController } from '../controllers/heldCart.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticateJWT);
router.post('/', HeldCartController.create);
router.get('/', HeldCartController.list);
router.post('/:id/resume', HeldCartController.resume);
router.delete('/:id', HeldCartController.remove);

export default router;
