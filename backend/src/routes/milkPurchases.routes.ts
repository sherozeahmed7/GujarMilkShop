import { Router } from 'express';
import { MilkPurchasesController } from '../controllers/milkPurchases.controller';

const router = Router();

router.get('/', MilkPurchasesController.get);

export default router;
