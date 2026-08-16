import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';

const router = Router();

router.get('/', InventoryController.get);

export default router;
