import { Router } from 'express';
import { ReturnsController } from '../controllers/returns.controller';

const router = Router();

router.get('/', ReturnsController.get);

export default router;
