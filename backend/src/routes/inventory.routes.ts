import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticateJWT);
router.get('/', InventoryController.list);
router.get('/summary', InventoryController.summary);
router.get('/pricing', InventoryController.pricing);
router.get('/stock-in', InventoryController.stockIn);
router.get('/movements', InventoryController.movements);
router.post('/movements', InventoryController.record);
router.post('/', InventoryController.create);
router.get('/:id', InventoryController.get);
router.put('/:id', InventoryController.update);
router.delete('/:id', InventoryController.remove);
export default router;