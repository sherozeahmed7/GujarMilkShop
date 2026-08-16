import { Router } from 'express';
import { KhataController } from '../controllers/khata.controller';

const router = Router();

router.get('/', KhataController.get);

export default router;
