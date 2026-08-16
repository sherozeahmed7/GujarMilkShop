import { Router } from 'express';
import { SuppliersController } from '../controllers/suppliers.controller';

const router = Router();

router.get('/', SuppliersController.get);

export default router;
