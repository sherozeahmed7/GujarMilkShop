import { Router } from 'express';
import { PaymentsController } from '../controllers/payments.controller';

const router = Router();

router.get('/', PaymentsController.get);

export default router;
