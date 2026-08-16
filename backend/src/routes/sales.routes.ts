import { Router } from 'express';
import { SalesController } from '../controllers/sales.controller';

const router = Router();

router.get('/', SalesController.get);

export default router;
