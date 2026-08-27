import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();
router.use(authenticateJWT);
router.get('/', SupplierController.list);
router.post('/', SupplierController.create);
router.put('/:id', SupplierController.update);
router.get('/:id', SupplierController.get);
router.get('/:id/entries', SupplierController.entries);
router.post('/:id/collections', SupplierController.collection);
router.post('/:id/payments', SupplierController.payment);
router.delete('/collections/:collectionId', SupplierController.deleteCollection);
export default router;